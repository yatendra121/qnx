/**
 * Helpers for scanning JavaScript and TypeScript source without a parser. A real one, such as
 * TypeScript's, is too large for this server. Findings based on these are heuristics and say so.
 */
export interface MaskedSource {
    /** Comments blanked out, strings kept. */
    noComments: string
    /** Comments and string contents blanked out, for matching structure such as braces. */
    structure: string
}

const blank = (char: string) => (char === '\n' ? '\n' : ' ')

/** Both outputs keep every character's position, so an index found in one maps back to the source. */
export function maskSource(code: string): MaskedSource {
    let noComments = ''
    let structure = ''
    let i = 0

    const push = (a: string, b: string) => {
        noComments += a
        structure += b
    }

    while (i < code.length) {
        const char = code[i]
        const next = code[i + 1]

        if (char === '/' && next === '/') {
            while (i < code.length && code[i] !== '\n') {
                push(' ', ' ')
                i++
            }
        } else if (char === '/' && next === '*') {
            const end = code.indexOf('*/', i + 2)
            const stop = end === -1 ? code.length : end + 2
            while (i < stop) {
                push(blank(code[i]), blank(code[i]))
                i++
            }
        } else if (char === '"' || char === "'" || char === '`') {
            push(char, char)
            i++
            while (i < code.length && code[i] !== char) {
                if (code[i] === '\\' && i + 1 < code.length) {
                    push(code[i], ' ')
                    i++
                }
                push(code[i], blank(code[i]))
                i++
            }
            if (i < code.length) {
                push(char, char)
                i++
            }
        } else {
            push(char, char)
            i++
        }
    }
    return { noComments, structure }
}

export function lineOfIndex(code: string, index: number) {
    return code.slice(0, index).split('\n').length
}

/**
 * These tools take untrusted input on a public endpoint, so work has to stay bounded:
 * a scan from every match to the end of the input would let a crafted file block the server.
 */
const MAX_SCAN_LENGTH = 50_000
export const MAX_MATCHES_PER_RULE = 200

/** matchAll, stopping after the first MAX_MATCHES_PER_RULE matches. */
export function* limitedMatches(text: string, pattern: RegExp) {
    let count = 0
    for (const match of text.matchAll(pattern)) {
        if (++count > MAX_MATCHES_PER_RULE) return
        yield match as RegExpExecArray
    }
}

function findClosing(structure: string, open: number, opener: string, closer: string) {
    let depth = 0
    const end = Math.min(structure.length, open + MAX_SCAN_LENGTH)
    for (let i = open; i < end; i++) {
        if (structure[i] === opener) depth++
        else if (structure[i] === closer && --depth === 0) return i
    }
    return -1
}

export function findClosingParen(structure: string, open: number) {
    return findClosing(structure, open, '(', ')')
}

export function findClosingBrace(structure: string, open: number) {
    return findClosing(structure, open, '{', '}')
}
