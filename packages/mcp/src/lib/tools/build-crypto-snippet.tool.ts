import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { quote } from './quote'
import { jsonResult, readOnlyTool, toolError } from './shared'

const operations = ['jwt-sign', 'jwt-verify', 'jwe-encrypt', 'jwe-decrypt', 'auth-token-generate', 'auth-token-decrypt'] as const

const keyTypes = ['symmetric', 'asymmetric'] as const

const paramRequirements: Record<typeof operations[number], string> = {
    'jwt-sign': 'Requires: keyType. Optional: payload, alg, subject, issuer, expirationTime, jti.',
    'jwt-verify': 'Requires: keyType. Optional: alg.',
    'jwe-encrypt': 'Requires: plaintext. Optional: alg, enc.',
    'jwe-decrypt': 'Optional: alg.',
    'auth-token-generate': 'Requires: subject.',
    'auth-token-decrypt': 'No extra params needed — keys loaded from env vars automatically.'
}

const jwtAlgs = {
    symmetric: ['HS256', 'HS384', 'HS512'],
    asymmetric: ['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'EdDSA']
}

/** Bytes the secret must have: a minimum for HMAC (RFC 7518), the exact length for AES key wrap. */
const hmacMinBytes: Record<string, number> = { HS256: 32, HS384: 48, HS512: 64 }
const aesKwBytes: Record<string, number> = { A128KW: 16, A192KW: 24, A256KW: 32 }

const jweAsymmetricAlgs = ['ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW', 'RSA-OAEP', 'RSA-OAEP-256', 'RSA-OAEP-384', 'RSA-OAEP-512']
const jweEncs = ['A128CBC-HS256', 'A192CBC-HS384', 'A256CBC-HS512', 'A128GCM', 'A192GCM', 'A256GCM']

const DEFAULT_JWE_ALG = 'ECDH-ES+A128KW'
const DEFAULT_JWE_ENC = 'A256CBC-HS512'

/** The same grammar jose uses, so a value accepted here can't throw "Invalid time period format". */
const TIME_PERIOD = /^(\+|-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i

const KEY_SETUP_DOCS = 'For generating keys and storing them in .env, see get-crypto-docs { "topic": "setup" }.'

/** process.env values are `string | undefined`, so a bare value doesn't compile under strict and fails confusingly at runtime. */
function readEnv(constName: string, envName: string) {
    return [
        `const ${constName} = process.env.${envName}`,
        `if (!${constName}) throw new Error('${envName} is not set')`
    ]
}

function checkJwtAlg(alg: string | undefined, keyType: typeof keyTypes[number]) {
    if (alg === undefined || jwtAlgs[keyType].includes(alg)) return undefined
    const otherType = keyType === 'symmetric' ? 'asymmetric' : 'symmetric'
    const hint = jwtAlgs[otherType].includes(alg) ? ` ${alg} needs keyType "${otherType}".` : ''
    return `Error: alg "${alg}" can't be used with keyType "${keyType}".${hint} Use one of: ${jwtAlgs[keyType].join(', ')}.`
}

function checkJweAlg(alg: string) {
    if (jweAsymmetricAlgs.includes(alg) || alg in aesKwBytes) return undefined
    return `Error: alg "${alg}" isn't supported by this generator. Use one of: ${[...jweAsymmetricAlgs, ...Object.keys(aesKwBytes)].join(', ')}.`
}

function secretNote(envName: string, alg: string) {
    if (alg in hmacMinBytes) {
        return `${envName} should be at least ${hmacMinBytes[alg]} bytes for ${alg} (RFC 7518). jose accepts shorter secrets, but they're weaker.`
    }
    return `${envName} must be exactly ${aesKwBytes[alg]} bytes for ${alg}, or encryption throws.`
}

export function registerBuildCryptoSnippetTool(server: McpServer) {
    server.registerTool(
        'build-crypto-snippet',
        {
            ...readOnlyTool('Generate a crypto snippet'),
            description: [
                'Generate a TypeScript code snippet for a @qnx/crypto operation with correct imports, key setup, and function call. Algorithm, key type and expiration combinations that would throw at runtime are rejected with isError.',
                '',
                'Required params per operation:',
                '  jwt-sign            → keyType (symmetric | asymmetric)',
                '  jwt-verify          → keyType (symmetric | asymmetric)',
                '  jwe-encrypt         → plaintext',
                '  jwe-decrypt         → (no required params)',
                '  auth-token-generate → subject',
                '  auth-token-decrypt  → (no required params)'
            ].join('\n'),
            inputSchema: {
                operation: z.enum(operations).describe(
                    'jwt-sign | jwt-verify | jwe-encrypt | jwe-decrypt | auth-token-generate | auth-token-decrypt'
                ),
                keyType: z.enum(keyTypes).optional().describe(
                    'jwt-sign / jwt-verify only — symmetric (HS256, HS384, HS512; uses toSymmetricSecret) | asymmetric (ES256 by default; uses PKCS8/SPKI keys)'
                ),
                payload: z.record(z.string(), z.unknown()).optional().describe(
                    'jwt-sign only — JWT claims payload (e.g. { userId: 42 })'
                ),
                alg: z.string().optional().describe(
                    'jwt-sign / jwt-verify: algorithm, default ES256 or HS256. jwe-encrypt / jwe-decrypt: key wrap algorithm, default ECDH-ES+A128KW'
                ),
                enc: z.string().optional().describe(
                    'jwe-encrypt only — content encryption algorithm (default A256CBC-HS512)'
                ),
                subject: z.string().optional().describe(
                    'jwt-sign / auth-token-generate — the sub claim or user identifier'
                ),
                issuer: z.string().optional().describe(
                    'jwt-sign only — the iss claim (e.g. "https://yourapp.com")'
                ),
                expirationTime: z.string().optional().describe(
                    'jwt-sign only — expiration (e.g. "2h", "7d", "30m")'
                ),
                jti: z.string().optional().describe(
                    'jwt-sign only — JWT ID for token tracking/revocation'
                ),
                plaintext: z.string().optional().describe(
                    'jwe-encrypt only — the string to encrypt'
                )
            }
        },
        async ({ operation, keyType, payload, alg, enc, subject, issuer, expirationTime, jti, plaintext }) => {
            let snippet: string
            const notes: string[] = []

            if (operation === 'jwt-sign') {
                if (!keyType) {
                    return toolError(`Error: jwt-sign requires "keyType". ${paramRequirements['jwt-sign']}`)
                }
                const algError = checkJwtAlg(alg, keyType)
                if (algError) return toolError(algError)
                if (expirationTime !== undefined && !TIME_PERIOD.test(expirationTime)) {
                    return toolError(`Error: expirationTime "${expirationTime}" isn't a time period jose accepts, so it would throw "Invalid time period format". Use a value like "30m", "2h" or "7d".`)
                }

                if (!payload) notes.push('No payload given, so the token carries only its registered claims. Pass payload to add your own.')
                if (!expirationTime) notes.push('No expirationTime given, so this token never expires. Pass one, such as "2h", unless that is what you want.')

                const signAlg = alg ?? (keyType === 'symmetric' ? 'HS256' : 'ES256')
                const payloadArg = JSON.stringify(payload ?? {})
                const options: Record<string, string> = {}
                // jwtSign defaults to ES256, whatever algorithm the key was imported for.
                if (signAlg !== 'ES256') options.alg = signAlg
                if (subject) options.subject = subject
                if (issuer) options.issuer = issuer
                if (expirationTime) options.expirationTime = expirationTime
                if (jti) options.jti = jti
                const optionsArg = Object.keys(options).length > 0 ? `, ${JSON.stringify(options)}` : ''

                if (keyType === 'symmetric') {
                    snippet = [
                        `import { jwtSign, toSymmetricSecret } from '@qnx/crypto'`,
                        ``,
                        ...readEnv('jwtSecret', 'JWT_SECRET'),
                        `const token = await jwtSign(${payloadArg}, toSymmetricSecret(jwtSecret)${optionsArg})`
                    ].join('\n')
                    notes.push(secretNote('JWT_SECRET', signAlg))
                } else {
                    snippet = [
                        `import { jwtSign, toPKCS8Secret } from '@qnx/crypto'`,
                        ``,
                        ...readEnv('privateKeyPem', 'JWT_PRIVATE_KEY'),
                        `const privateKey = await toPKCS8Secret(privateKeyPem, '${signAlg}')`,
                        `const token = await jwtSign(${payloadArg}, privateKey${optionsArg})`
                    ].join('\n')
                    notes.push(KEY_SETUP_DOCS)
                }
            } else if (operation === 'jwt-verify') {
                if (!keyType) {
                    return toolError(`Error: jwt-verify requires "keyType". ${paramRequirements['jwt-verify']}`)
                }
                const algError = checkJwtAlg(alg, keyType)
                if (algError) return toolError(algError)

                if (keyType === 'symmetric') {
                    snippet = [
                        `import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'`,
                        ``,
                        ...readEnv('jwtSecret', 'JWT_SECRET'),
                        `const { payload } = await jwtVerify(token, toSymmetricSecret(jwtSecret))`
                    ].join('\n')
                } else {
                    snippet = [
                        `import { jwtVerify, toSPKISecret } from '@qnx/crypto'`,
                        ``,
                        ...readEnv('publicKeyPem', 'JWT_PUBLIC_KEY'),
                        `const publicKey = await toSPKISecret(publicKeyPem, '${alg ?? 'ES256'}')`,
                        `const { payload } = await jwtVerify(token, publicKey)`
                    ].join('\n')
                }
                notes.push('jwtVerify throws if the token is expired, has an invalid signature, or fails claims checks — wrap in try/catch.')
            } else if (operation === 'jwe-encrypt' || operation === 'jwe-decrypt') {
                const jweAlg = alg ?? DEFAULT_JWE_ALG
                const algError = checkJweAlg(jweAlg)
                if (algError) return toolError(algError)
                const isSymmetric = jweAlg in aesKwBytes

                if (operation === 'jwe-encrypt') {
                    if (!plaintext) {
                        return toolError(`Error: jwe-encrypt requires "plaintext". ${paramRequirements['jwe-encrypt']}`)
                    }
                    if (enc !== undefined && !jweEncs.includes(enc)) {
                        return toolError(`Error: enc "${enc}" isn't a content encryption algorithm. Use one of: ${jweEncs.join(', ')}.`)
                    }
                    // Both are required by the type once options are passed, even though either has a default at runtime.
                    const encOptions = alg || enc ? `, { alg: '${jweAlg}', enc: '${enc ?? DEFAULT_JWE_ENC}' }` : ''
                    snippet = isSymmetric
                        ? [
                            `import { jweEncrypt, toSymmetricSecret } from '@qnx/crypto'`,
                            ``,
                            ...readEnv('jweSecret', 'JWE_SECRET'),
                            `const jwe = await jweEncrypt(${quote(plaintext)}, toSymmetricSecret(jweSecret)${encOptions})`
                        ].join('\n')
                        : [
                            `import { jweEncrypt, toSPKISecret } from '@qnx/crypto'`,
                            ``,
                            ...readEnv('publicKeyPem', 'JWE_PUBLIC_KEY'),
                            `const publicKey = await toSPKISecret(publicKeyPem, '${jweAlg}')`,
                            `const jwe = await jweEncrypt(${quote(plaintext)}, publicKey${encOptions})`
                        ].join('\n')
                } else {
                    snippet = isSymmetric
                        ? [
                            `import { jweDecrypt, toSymmetricSecret } from '@qnx/crypto'`,
                            ``,
                            ...readEnv('jweSecret', 'JWE_SECRET'),
                            `const { plaintext } = await jweDecrypt(jwe, toSymmetricSecret(jweSecret))`
                        ].join('\n')
                        : [
                            `import { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'`,
                            ``,
                            ...readEnv('privateKeyPem', 'JWE_PRIVATE_KEY'),
                            `const privateKey = await toPKCS8Secret(privateKeyPem, '${jweAlg}')`,
                            `const { plaintext } = await jweDecrypt(jwe, privateKey)`
                        ].join('\n')
                    notes.push('plaintext is returned as a string — jweDecrypt decodes the Uint8Array automatically.')
                }
                if (isSymmetric) notes.push(secretNote('JWE_SECRET', jweAlg))
            } else if (operation === 'auth-token-generate') {
                if (!subject) {
                    return toolError(`Error: auth-token-generate requires "subject". ${paramRequirements['auth-token-generate']}`)
                }
                snippet = [
                    `import { generateAuthToken } from '@qnx/crypto'`,
                    ``,
                    `const { token, dbToken } = await generateAuthToken(${quote(subject)})`,
                    ``,
                    `// token   → JWE-encrypted token, send to client`,
                    `// dbToken → UUID (jti), store in DB to track/revoke sessions`
                ].join('\n')
                notes.push('Requires env vars: JWT_PRIVATE_KEY, JWE_PUBLIC_KEY.')
                notes.push('The token has no expiry and generateAuthToken has no option to set one. Store an expiry with dbToken and check it on every request, or the token stays valid forever. See get-guide { "topic": "auth-session" }.')
                notes.push(KEY_SETUP_DOCS)
            } else {
                // auth-token-decrypt
                snippet = [
                    `import { decryptAuthToken } from '@qnx/crypto'`,
                    ``,
                    `try {`,
                    `  const payload = await decryptAuthToken(token)`,
                    `  const userId = payload.sub   // subject passed to generateAuthToken`,
                    `  const jti = payload.jti      // match against DB to validate the session and its expiry`,
                    `} catch (error) {`,
                    `  // token is invalid or tampered. It can't be expired here: these tokens have no exp claim.`,
                    `}`
                ].join('\n')
                notes.push('Requires env vars: JWT_PUBLIC_KEY, JWE_PRIVATE_KEY.')
                notes.push('decryptAuthToken doesn\'t reject old tokens because they carry no exp claim. Session lifetime and revocation are only enforced by your jti lookup. See get-guide { "topic": "auth-session" }.')
            }

            return jsonResult({
                operation,
                snippet,
                ...(notes.length > 0 && { notes })
            })
        }
    )
}
