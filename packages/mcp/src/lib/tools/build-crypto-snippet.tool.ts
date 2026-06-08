import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const operations = ['jwt-sign', 'jwt-verify', 'jwe-encrypt', 'jwe-decrypt', 'auth-token-generate', 'auth-token-decrypt'] as const

const keyTypes = ['symmetric', 'asymmetric'] as const

const paramRequirements: Record<typeof operations[number], string> = {
    'jwt-sign': 'Requires: keyType. Optional: payload, alg, subject, issuer, expirationTime, jti.',
    'jwt-verify': 'Requires: keyType.',
    'jwe-encrypt': 'Requires: plaintext. Optional: alg, enc.',
    'jwe-decrypt': 'Optional: alg.',
    'auth-token-generate': 'Requires: subject.',
    'auth-token-decrypt': 'No extra params needed — keys loaded from env vars automatically.'
}

export function registerBuildCryptoSnippetTool(server: McpServer) {
    server.registerTool(
        'build-crypto-snippet',
        {
            description: [
                'Generate a ready-to-use TypeScript code snippet for a @qnx/crypto operation with correct imports, key setup, and function call.',
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
                    'jwt-sign / jwt-verify only — symmetric (HS256, uses toSymmetricSecret) | asymmetric (ES256, uses PKCS8/SPKI keys)'
                ),
                payload: z.record(z.string(), z.unknown()).optional().describe(
                    'jwt-sign only — JWT claims payload (e.g. { userId: 42 })'
                ),
                alg: z.string().optional().describe(
                    'jwt-sign: override algorithm (default ES256 or HS256). jwe-encrypt/decrypt: key wrap algorithm (default ECDH-ES+A128KW)'
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
                    return {
                        content: [{ type: 'text', text: `Error: jwt-sign requires "keyType". ${paramRequirements['jwt-sign']}` }]
                    }
                }

                const payloadArg = payload ? JSON.stringify(payload) : '{ userId: 42 }'
                const options: Record<string, string> = {}
                if (keyType === 'symmetric') options.alg = alg ?? 'HS256'
                if (subject) options.subject = subject
                if (issuer) options.issuer = issuer
                if (expirationTime) options.expirationTime = expirationTime
                if (jti) options.jti = jti
                const optionsArg = Object.keys(options).length > 0 ? `, ${JSON.stringify(options)}` : ''

                if (keyType === 'symmetric') {
                    snippet = [
                        `import { jwtSign, toSymmetricSecret } from '@qnx/crypto'`,
                        ``,
                        `const secret = toSymmetricSecret(process.env.JWT_SECRET)`,
                        `const token = await jwtSign(${payloadArg}, secret${optionsArg})`
                    ].join('\n')
                } else {
                    snippet = [
                        `import { jwtSign, toPKCS8Secret } from '@qnx/crypto'`,
                        ``,
                        `const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY, '${alg ?? 'ES256'}')`,
                        `const token = await jwtSign(${payloadArg}, privateKey${optionsArg})`
                    ].join('\n')
                }
            } else if (operation === 'jwt-verify') {
                if (!keyType) {
                    return {
                        content: [{ type: 'text', text: `Error: jwt-verify requires "keyType". ${paramRequirements['jwt-verify']}` }]
                    }
                }

                if (keyType === 'symmetric') {
                    snippet = [
                        `import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'`,
                        ``,
                        `const secret = toSymmetricSecret(process.env.JWT_SECRET)`,
                        `const { payload } = await jwtVerify(token, secret)`
                    ].join('\n')
                } else {
                    snippet = [
                        `import { jwtVerify, toSPKISecret } from '@qnx/crypto'`,
                        ``,
                        `const publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY, '${alg ?? 'ES256'}')`,
                        `const { payload } = await jwtVerify(token, publicKey)`
                    ].join('\n')
                }
                notes.push('jwtVerify throws if the token is expired, has an invalid signature, or fails claims checks — wrap in try/catch.')
            } else if (operation === 'jwe-encrypt') {
                if (!plaintext) {
                    return {
                        content: [{ type: 'text', text: `Error: jwe-encrypt requires "plaintext". ${paramRequirements['jwe-encrypt']}` }]
                    }
                }
                const encOptions = alg || enc ? `, { alg: '${alg ?? 'ECDH-ES+A128KW'}', enc: '${enc ?? 'A256CBC-HS512'}' }` : ''
                snippet = [
                    `import { jweEncrypt, toSPKISecret } from '@qnx/crypto'`,
                    ``,
                    `const publicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY, '${alg ?? 'ECDH-ES+A128KW'}')`,
                    `const jwe = await jweEncrypt('${plaintext}'${encOptions ? `, publicKey${encOptions}` : ', publicKey'})`
                ].join('\n')
            } else if (operation === 'jwe-decrypt') {
                snippet = [
                    `import { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'`,
                    ``,
                    `const privateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY, '${alg ?? 'ECDH-ES+A128KW'}')`,
                    `const { plaintext } = await jweDecrypt(jwe, privateKey)`
                ].join('\n')
                notes.push('plaintext is returned as a string — jweDecrypt decodes the Uint8Array automatically.')
            } else if (operation === 'auth-token-generate') {
                if (!subject) {
                    return {
                        content: [{ type: 'text', text: `Error: auth-token-generate requires "subject". ${paramRequirements['auth-token-generate']}` }]
                    }
                }
                snippet = [
                    `import { generateAuthToken } from '@qnx/crypto'`,
                    ``,
                    `const { token, dbToken } = await generateAuthToken('${subject}')`,
                    ``,
                    `// token   → JWE-encrypted token, send to client`,
                    `// dbToken → UUID (jti), store in DB to track/revoke sessions`
                ].join('\n')
                notes.push('Requires env vars: JWT_PRIVATE_KEY, JWE_PUBLIC_KEY.')
            } else {
                // auth-token-decrypt
                snippet = [
                    `import { decryptAuthToken } from '@qnx/crypto'`,
                    ``,
                    `try {`,
                    `  const payload = await decryptAuthToken(token)`,
                    `  const userId = payload.sub   // subject passed to generateAuthToken`,
                    `  const jti = payload.jti      // match against DB to validate session`,
                    `} catch (error) {`,
                    `  // token is invalid, expired, or tampered`,
                    `}`
                ].join('\n')
notes.push('Requires env vars: JWT_PUBLIC_KEY, JWE_PRIVATE_KEY.')
            }

            const result = {
                operation,
                snippet,
                ...(notes.length > 0 && { notes })
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            }
        }
    )
}
