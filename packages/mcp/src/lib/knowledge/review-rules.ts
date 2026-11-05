import type { McpServerConfig } from '../server'
import { findClosingBrace, findClosingParen, limitedMatches, lineOfIndex, maskSource, type MaskedSource } from './source-scan'

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
    rule: string
    package: string
    severity: Severity
    line: number
    code: string
    problem: string
    fix: string
    docs?: string
}

type Report = (index: number, rule: Omit<Finding, 'line' | 'code'>) => void

interface Rule {
    package: keyof McpServerConfig
    check: (source: MaskedSource, report: Report) => void
}

const has = (text: string, pattern: RegExp) => pattern.test(text)

/** Finds each function body passed to asyncValidatorHandler. */
function handlerBlocks({ structure }: MaskedSource) {
    const blocks: { index: number; start: number; end: number; body: string }[] = []
    for (const match of limitedMatches(structure, /\basyncValidatorHandler\s*(?:<[^>]{0,200}>)?\s*\(/g)) {
        const open = match.index + match[0].length - 1
        const close = findClosingParen(structure, open)
        if (close === -1) continue
        const args = structure.slice(open + 1, close)
        const arrow = args.indexOf('=>')
        const fn = /\bfunction\b[^{]*\{/.exec(args)
        const brace = arrow !== -1 ? /^\s*\{/.exec(args.slice(arrow + 2)) : fn ? fn : null
        if (!brace) continue
        const braceIndex = arrow !== -1
            ? open + 1 + arrow + 2 + brace[0].length - 1
            : open + 1 + brace.index + brace[0].length - 1
        const end = findClosingBrace(structure, braceIndex)
        if (end === -1) continue
        blocks.push({ index: match.index, start: braceIndex, end, body: structure.slice(braceIndex + 1, end) })
    }
    return blocks
}

const forEachMatch = (text: string, pattern: RegExp, callback: (match: RegExpMatchArray & { index: number }) => void) => {
    for (const match of limitedMatches(text, pattern)) callback(match)
}

const RESPONSE = '@qnx/response'
const ERRORS = '@qnx/errors'
const CLIENT = '@qnx/client'
const WINSTON = '@qnx/winston'
const CRYPTO = '@qnx/crypto'
const LOG = '@qnx/log'

const LEGACY_ROUTE = /\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*[^,]{1,300},\s*(?:async\s*)?(?:\([^)]{0,100}\bres\b[^)]{0,100}\)|function\s*\([^)]{0,100}\bres\b[^)]{0,100}\))/g

export const reviewRules: Rule[] = [
    {
        package: 'response',
        check(source, report) {
            for (const { index, body } of handlerBlocks(source)) {
                const responds = has(body, /\breturn\b/) || has(body, /\bres\s*\./) || has(body, /\bnext\s*\(/)
                const endsWithThrow = /\bthrow\b[^;]*;?\s*$/.test(body.trim())
                if (!responds && !endsWithThrow) {
                    report(index, {
                        rule: 'handler-returns-nothing',
                        package: RESPONSE,
                        severity: 'error',
                        problem: 'This handler never returns or responds. It calls next() when it finishes, and if no later route matches, the client gets an HTML 404, even though the work was done.',
                        fix: 'Return a value, such as initializeApiResponse().setMessage(\'Done.\'). Ignore this only if it is middleware meant to continue to the next handler.',
                        docs: 'get-response-docs { "pattern": "handler-return-values" }'
                    })
                }
            }
        }
    },
    {
        package: 'response',
        check(source, report) {
            for (const { start, body } of handlerBlocks(source)) {
                forEachMatch(body, /\bthrow\s+new\s+(?:Error|TypeError|RangeError|ReferenceError|SyntaxError)\s*\(/g, (match) => {
                    report(start + 1 + match.index, {
                        rule: 'plain-error-reaches-client',
                        package: RESPONSE,
                        severity: 'warning',
                        problem: 'A plain Error thrown here is sent to the client with its message and full stack trace, in every environment.',
                        fix: 'Throw ServerError or ApiError from @qnx/errors with a message that is safe to show, and log the details on the server.',
                        docs: 'get-response-docs { "pattern": "server-error" }'
                    })
                })
            }
        }
    },
    {
        package: 'response',
        check({ structure }, report) {
            forEachMatch(structure, /\b(throwInvalidValueApiResponse|invalidValueApiResponse)\s*\(/g, (match) => {
                report(match.index, {
                    rule: 'deprecated-response-helper',
                    package: RESPONSE,
                    severity: 'info',
                    problem: `${match[1]} is deprecated.`,
                    fix: 'Throw InvalidValueError from @qnx/errors: throw new InvalidValueError(message, { key }). It sends the same response.',
                    docs: 'get-response-docs { "pattern": "invalid-value" }'
                })
            })
        }
    },
    {
        package: 'response',
        check({ noComments }, report) {
            if (has(noComments, /@qnx\/response/) || has(noComments, /asyncValidatorHandler/)) {
                forEachMatch(noComments, LEGACY_ROUTE, (match) => {
                    report(match.index, {
                        rule: 'route-without-async-handler',
                        package: RESPONSE,
                        severity: 'info',
                        problem: 'This route handles the response itself in a file that otherwise uses @qnx/response, so its errors and response shape can differ from the others.',
                        fix: 'Pass the source to transform-to-async-handler for line-by-line conversions that keep its status codes.',
                        docs: 'transform-to-async-handler'
                    })
                })
            }
        }
    },
    {
        package: 'errors',
        check({ noComments, structure }, report) {
            forEachMatch(structure, /\bnew\s+UnauthenticatedUserError\s*\(\s*\S/g, (match) => {
                // Ignores a generic message, which loses nothing by not being sent.
                const text = noComments.slice(match.index, noComments.indexOf('\n', match.index))
                if (!/\(\s*['"`](unauthenticated|not authenticated)['"`]/i.test(text)) {
                    report(match.index, {
                        rule: 'unauthenticated-message-not-sent',
                        package: ERRORS,
                        severity: 'info',
                        problem: 'This message never reaches the client. The body is always { errorCode: "unauthenticated", message: "Unauthenticated" }.',
                        fix: 'If the client needs this text, use throw new ApiError(message, 401). Otherwise, this is fine.',
                        docs: 'get-error-class-docs { "errorClass": "http-responses" }'
                    })
                }
            })
        }
    },
    {
        package: 'errors',
        check({ structure }, report) {
            forEachMatch(structure, /\.\s*setError\s*\([^;]{0,500}?\)\s*\.\s*setError\s*\(/g, (match) => {
                report(match.index, {
                    rule: 'set-error-replaces-others',
                    package: ERRORS,
                    severity: 'error',
                    problem: 'On ApiResponseErrorsValue, setError replaces everything collected so far, including other fields, so only the last call is kept.',
                    fix: 'Use addError to collect several errors.',
                    docs: 'get-error-class-docs { "errorClass": "ApiResponseErrorsValue" }'
                })
            })
        }
    },
    {
        package: 'client',
        check({ structure }, report) {
            forEachMatch(structure, /\bif\s*\(\s*!?\s*[\w$.]+\s*\.\s*getError\s*\(\s*\)\s*\)/g, (match) => {
                report(match.index, {
                    rule: 'client-get-error-check',
                    package: CLIENT,
                    severity: 'error',
                    problem: 'getError() is only set on validation responses. It is undefined on real 401, 409 and 500 responses, so this check treats them as successes.',
                    fix: 'Check response.ok or the status, then read getError() ?? getMessage().',
                    docs: 'get-client-docs { "topic": "handling-responses" }'
                })
            })
        }
    },
    {
        package: 'client',
        check({ structure }, report) {
            forEachMatch(structure, /\bif\s*\(\s*!\s*(?:raw|json|body|result|payload|res|response)\s*\.\s*data\s*\)/g, (match) => {
                report(match.index, {
                    rule: 'client-missing-data-check',
                    package: CLIENT,
                    severity: 'error',
                    problem: 'A message-only success, such as a DELETE responding { message: "Deleted." }, has no data, so this check treats it as a failure.',
                    fix: 'Check response.ok or the status.',
                    docs: 'get-client-docs { "topic": "handling-responses" }'
                })
            })
        }
    },
    {
        package: 'client',
        check({ noComments, structure }, report) {
            forEachMatch(structure, /\bfetch\s*\(/g, (match) => {
                const open = match.index + match[0].length - 1
                const close = findClosingParen(structure, open)
                if (close === -1) return
                const call = noComments.slice(open, close)
                if (has(call, /\bbody\s*:\s*JSON\.stringify/) && !has(call, /content-type/i) && !has(call, /\bheaders\b/)) {
                    report(match.index, {
                        rule: 'fetch-without-content-type',
                        package: CLIENT,
                        severity: 'error',
                        problem: 'This JSON body has no Content-Type header, so express.json() skips it, req.body is undefined, and validation fails with "expected object, received undefined".',
                        fix: 'Add headers: { \'Content-Type\': \'application/json\' }.',
                        docs: 'get-client-docs { "topic": "handling-responses" }'
                    })
                }
            })
        }
    },
    {
        package: 'winston',
        check({ structure }, report) {
            forEachMatch(structure, /\b(?:logger|log)\s*\.\s*(?:error|warn|info|http|verbose|debug|silly)\s*\([^;{}]{0,500}\{[^{}]{0,500}?\b(?:(?:error|err|e|exception)\s*[,}]|(?:error|err|exception)\s*:\s*(?:error|err|e|exception|ex)\b)/g, (match) => {
                report(match.index, {
                    rule: 'error-nested-in-log-metadata',
                    package: WINSTON,
                    severity: 'error',
                    problem: 'If this is an Error instance, it is written as {}, with no message and no stack.',
                    fix: 'Pass the Error as the second argument: logger.error(\'message\', err). To add metadata too, copy err.message and err.stack into it.',
                    docs: 'get-file-logger-docs { "topic": "logging-errors" }'
                })
            })
        }
    },
    {
        package: 'winston',
        check({ structure }, report) {
            forEachMatch(structure, /\blogger\s*\.\s*error\s*\(\s*(?:err|error|e|ex|exception)\s*\)/g, (match) => {
                report(match.index, {
                    rule: 'error-as-only-log-argument',
                    package: WINSTON,
                    severity: 'error',
                    problem: 'Logging an Error as the only argument writes no message and no stack.',
                    fix: 'Add a message: logger.error(\'What failed\', err).',
                    docs: 'get-file-logger-docs { "topic": "logging-errors" }'
                })
            })
        }
    },
    {
        package: 'winston',
        check({ structure }, report) {
            forEachMatch(structure, /\blogger\s*\.\s*silly\s*\(/g, (match) => {
                report(match.index, {
                    rule: 'silly-never-written',
                    package: WINSTON,
                    severity: 'warning',
                    problem: 'The logger only writes debug and above, so this entry is never written.',
                    fix: 'Use logger.debug.',
                    docs: 'get-file-logger-docs { "topic": "levels" }'
                })
            })
        }
    },
    {
        package: 'crypto',
        check({ noComments, structure }, report) {
            // Worked out once: doing this per call would make the rule quadratic on a crafted file.
            const symmetricKeys = new Set([...limitedMatches(noComments, /\b([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?toSymmetricSecret\s*\(/g)].map((found) => found[1]))
            const otherAlgImport = /toPKCS8Secret\s*\([^)]{0,300},\s*['"`](?!ES256)[^'"`]{1,30}['"`]\s*\)/.exec(noComments)

            forEachMatch(structure, /\bjwtSign\s*\(/g, (match) => {
                const open = match.index + match[0].length - 1
                const close = findClosingParen(structure, open)
                if (close === -1) return
                const call = noComments.slice(open, close)
                const hasAlg = has(call, /\balg\s*:/)
                const symmetric = has(call, /toSymmetricSecret/) || [...limitedMatches(call, /\b([A-Za-z_$][\w$]*)\b/g)].some(([, name]) => symmetricKeys.has(name))
                const otherAlg = otherAlgImport && otherAlgImport.index < match.index

                if (!hasAlg && symmetric) {
                    report(match.index, {
                        rule: 'symmetric-sign-without-alg',
                        package: CRYPTO,
                        severity: 'error',
                        problem: 'jwtSign defaults to ES256, so a symmetric secret without alg throws "Key for the ES256 algorithm must be...".',
                        fix: 'Pass alg: \'HS256\'.',
                        docs: 'get-crypto-docs { "topic": "jwt" }'
                    })
                } else if (!hasAlg && otherAlg) {
                    report(match.index, {
                        rule: 'asymmetric-sign-without-alg',
                        package: CRYPTO,
                        severity: 'error',
                        problem: 'The key was imported for another algorithm, but jwtSign defaults to ES256, so this throws "CryptoKey does not support this operation".',
                        fix: 'Pass the same alg to jwtSign as to toPKCS8Secret.',
                        docs: 'get-crypto-docs { "topic": "jwt" }'
                    })
                }
                if (!has(call, /\bexpirationTime\s*:/)) {
                    report(match.index, {
                        rule: 'jwt-without-expiry',
                        package: CRYPTO,
                        severity: 'warning',
                        problem: 'This token has no expirationTime, so it never expires.',
                        fix: 'Pass expirationTime, such as \'2h\'.',
                        docs: 'get-crypto-docs { "topic": "jwt" }'
                    })
                }
            })
        }
    },
    {
        package: 'crypto',
        check({ noComments }, report) {
            forEachMatch(noComments, /\btoSymmetricSecret\s*\(\s*(['"`])([^'"`]*)\1\s*\)/g, (match) => {
                const bytes = new TextEncoder().encode(match[2]).length
                report(match.index, {
                    rule: 'hardcoded-secret',
                    package: CRYPTO,
                    severity: 'error',
                    problem: `This secret is written in the source${bytes < 32 ? `, and at ${bytes} bytes it is below the 32-byte minimum for HS256` : ''}.`,
                    fix: 'Read it from an environment variable, and use at least 32 random bytes for HS256.',
                    docs: 'get-crypto-docs { "topic": "key-helpers" }'
                })
            })
        }
    },
    {
        package: 'crypto',
        check({ structure }, report) {
            // Any expiry handling in the file counts, so this only needs checking once.
            const handlesExpiry = has(structure, /expires?(At|_at|In)?\b/i) || has(structure, /\bttl\b/i)
            forEachMatch(structure, /\bgenerateAuthToken\s*\(/g, (match) => {
                if (!handlesExpiry) {
                    report(match.index, {
                        rule: 'auth-token-without-expiry',
                        package: CRYPTO,
                        severity: 'warning',
                        problem: 'Auth tokens have no exp claim and stay valid forever. No session expiry is visible in this code.',
                        fix: 'Store an expiry with dbToken and check it on every request. If that is handled elsewhere, this is fine.',
                        docs: 'get-guide { "topic": "auth-session" }'
                    })
                }
            })
        }
    },
    {
        package: 'log',
        check({ noComments }, report) {
            forEachMatch(noComments, /\bconsoleLog\s*\(\s*`[^`]{0,500}\$\{\s*\w{1,100}\.message\s*\}[^`]{0,500}`/g, (match) => {
                report(match.index, {
                    rule: 'console-log-error-message',
                    package: LOG,
                    severity: 'info',
                    problem: 'Logging only the message drops the stack trace and cause chain.',
                    fix: 'Pass the Error itself: consoleLog(err, { type: \'error\' }).',
                    docs: 'get-console-log-docs { "topic": "types" }'
                })
            })
        }
    }
]

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info']

export function reviewCode(code: string, config: McpServerConfig): Finding[] {
    const source = maskSource(code)
    const lines = code.split('\n')
    const findings: Finding[] = []

    for (const rule of reviewRules) {
        if (!config[rule.package]) continue
        rule.check(source, (index, finding) => {
            const line = lineOfIndex(code, index)
            findings.push({ ...finding, line, code: lines[line - 1].trim() })
        })
    }

    return findings.slice().sort((a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.line - b.line
    )
}
