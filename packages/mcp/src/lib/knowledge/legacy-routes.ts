import { maskSource, lineOfIndex, findClosingParen, limitedMatches } from './source-scan'

export const legacyPatterns = ['callback-query', 'callback-try-catch', 'promise-chain', 'express-next'] as const

export type LegacyPattern = typeof legacyPatterns[number]

export interface Conversion {
    line: number
    original: string
    becomes: string
    note?: string
}

export interface LegacyAnalysis {
    patterns: LegacyPattern[]
    conversions: Conversion[]
    notes: string[]
}

/** Reads the value of a simple top-level `key: value` from an object literal's source. */
function readProperty(source: string, key: string) {
    const start = new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*`).exec(source)
    if (!start) return /[{,\s]/.test(source) && new RegExp(`[{,]\\s*${key}\\s*[,}]`).test(source) ? key : undefined
    let depth = 0
    let quote: string | undefined
    const begin = start.index + start[0].length
    for (let i = begin; i < source.length; i++) {
        const char = source[i]
        if (quote) {
            if (char === '\\') i++
            else if (char === quote) quote = undefined
        } else if (char === '"' || char === "'" || char === '`') quote = char
        else if ('([{'.includes(char)) depth++
        else if (')]}'.includes(char)) {
            if (depth === 0) return source.slice(begin, i).trim()
            depth--
        } else if (char === ',' && depth === 0) return source.slice(begin, i).trim()
    }
    return source.slice(begin).trim()
}

function convertSuccess(status: number, payload: string) {
    const isObject = payload.startsWith('{')
    const data = isObject ? readProperty(payload, 'data') : payload
    const message = isObject ? readProperty(payload, 'message') : undefined
    const keys = isObject ? [data && 'data', message && 'message'].filter(Boolean).length : 0
    const hasOtherKeys = isObject && payload.replace(/\s/g, '') !== '{}' && keys === 0

    const start = status === 200 ? 'initializeApiResponse()' : `ApiResponse.getInstance().setStatusCode(${status})`
    let call = `return ${start}`
    if (hasOtherKeys) call += `.setData(${payload})`
    else {
        if (data) call += `.setData(${data})`
        if (message) call += `.setMessage(${message})`
    }
    return {
        becomes: call,
        note: hasOtherKeys ? 'The object is now nested under `data`. Update clients, or use `setAdditional` to keep its fields at the top level.' : status === 200 ? undefined : `Keeps status ${status}.`
    }
}

function convertError(status: number, payload: string) {
    const isObject = payload.startsWith('{')
    const text = (isObject ? readProperty(payload, 'error') ?? readProperty(payload, 'message') : payload) || "'Request failed'"
    const usesCaughtMessage = /\.message\b/.test(text)

    if (status === 401) {
        return {
            becomes: `throw new UnauthenticatedUserError(${text})`,
            note: 'The body becomes `{ errorCode: \'unauthenticated\', message: \'Unauthenticated\' }`: your message is not sent.'
        }
    }
    if (status >= 500 && usesCaughtMessage) {
        return {
            becomes: 'remove this: let the error propagate, or log it and throw new ServerError(\'A safe message\')',
            note: 'A plain error that propagates responds 500 with its message and stack trace. `ServerError` sends only the message you choose.'
        }
    }
    if (status === 500) {
        return { becomes: `throw new ServerError(${text})`, note: 'Sends `{ message }`. Log the original error first: `setCallback` isn\'t called for this class.' }
    }
    if (status === 400 || status === 422) {
        return {
            becomes: `throw new InvalidValueError(${text}, { key: 'fieldName' })`,
            note: `Replace fieldName with the invalid field. The body becomes \`{ errors, error }\`.${status === 422 ? ' Validation responses are 400 unless you call `setErrorCodes({ VALIDATION_ERROR_CODE: 422 })` at startup, so use `throw new ApiError(message, 422)` for this route only.' : ''}`
        }
    }
    return {
        becomes: `throw new ApiError(${text}, ${status})`,
        note: `Keeps status ${status}. The body becomes \`{ message }\`${isObject && readProperty(payload, 'error') ? ', not `{ error }`' : ''}.`
    }
}

/**
 * Detects legacy route patterns and maps each direct response to its @qnx/response equivalent.
 * It works on masked source text rather than a syntax tree, so a parser isn't needed in the server.
 */
export function analyzeLegacyRoute(code: string): LegacyAnalysis {
    const { noComments, structure } = maskSource(code)
    const patterns = new Set<LegacyPattern>()
    const notes = new Set<string>()
    const conversions: Conversion[] = []

    if (/\.(query|execute)\s*\([^;]{0,1000}?(function\s*\(|\()\s*\w{0,20}err\w{0,20}\s*,/.test(noComments)) patterns.add('callback-query')
    if (/\.then\s*\(/.test(structure)) patterns.add('promise-chain')
    if (/\bnext\s*\(\s*\w+\s*\)/.test(structure)) patterns.add('express-next')
    if (/\btry\s*\{/.test(structure) && /\bres\s*\.\s*(status|json|send)\s*\(/.test(structure)) patterns.add('callback-try-catch')

    const responseCall = /\bres\s*(?:\.\s*status\s*\(\s*(\d+)\s*\)\s*)?\.\s*(json|send)\s*\(/g
    for (const match of limitedMatches(structure, responseCall)) {
        const open = match.index + match[0].length - 1
        const close = findClosingParen(structure, open)
        if (close === -1) continue
        const payload = noComments.slice(open + 1, close).trim()
        const status = match[1] ? Number(match[1]) : 200
        const { becomes, note } = status < 400 ? convertSuccess(status, payload) : convertError(status, payload)
        conversions.push({
            line: lineOfIndex(code, match.index),
            original: noComments.slice(match.index, close + 1).replace(/\s+/g, ' '),
            becomes,
            ...(note && { note })
        })
    }

    for (const match of limitedMatches(structure, /\bres\s*\.\s*sendStatus\s*\(\s*(\d+)\s*\)/g)) {
        const status = Number(match[1])
        conversions.push({
            line: lineOfIndex(code, match.index),
            original: match[0],
            becomes: status < 400
                ? `return ApiResponse.getInstance().setStatusCode(${status}).setMessage('...')`
                : `throw new ApiError('...', ${status})`,
            note: `Keeps status ${status}. Express sent its status text as plain text; this sends JSON.`
        })
    }

    if (patterns.has('express-next')) {
        notes.add('`asyncValidatorHandler` never calls your app\'s error handler. If it logs or sanitises errors, keep `next(err)` in a catch block, or errors and their stack traces go to the client.')
    }
    if (patterns.has('callback-query')) {
        notes.add('`await` needs a promise-based query: use `mysql2/promise`, `pool.promise()` or `util.promisify`.')
    }
    if (/\bres\s*\.\s*(redirect|render|sendFile|download|end|write|set|cookie|setHeader)\s*\(/.test(structure)) {
        notes.add('Keep other `res` calls such as `redirect`, `render`, `cookie` or `setHeader` as they are, and `return` the result of any that sends a response. Returning nothing would call `next()`.')
    }
    if (conversions.some(({ becomes }) => becomes.includes('remove this'))) {
        notes.add('Removing a catch block sends unexpected errors to the client with their stack trace. See `safeHandler` in get-response-docs { "pattern": "server-error" }.')
    }
    if (conversions.length > 0) {
        notes.add('Add the imports each conversion uses: `asyncValidatorHandler`, `initializeApiResponse` and `ApiResponse` from `@qnx/response`, and error classes from `@qnx/errors`.')
    }

    return { patterns: [...patterns], conversions, notes: [...notes] }
}
