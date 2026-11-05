import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readOnlyTool, textResult } from './shared'

const topics = ['overview', 'setup', 'jwt', 'jwe', 'auth-token', 'key-helpers', 'algorithms', 'troubleshooting', 'all'] as const

export const cryptoDocs: Record<Exclude<typeof topics[number], 'all'>, string> = {
    overview: `## Overview

\`@qnx/crypto\` provides JWT signing/verification and JWE encryption/decryption built on the [jose](https://github.com/panva/jose) library.

**Installation**
\`\`\`bash
npm install @qnx/crypto jose uuid
\`\`\`

\`jose\` 6 and \`uuid\` 13 or 14 are peer dependencies. npm installs them automatically by default, but not with \`--legacy-peer-deps\` or other package managers configured not to, and the import then fails with \`ERR_MODULE_NOT_FOUND\`.

Next, generate your keys: see the setup topic.

**Two usage levels**

| Level | Functions | Keys |
| --- | --- | --- |
| Core | \`jwtSign\`, \`jwtVerify\`, \`jweEncrypt\`, \`jweDecrypt\` | You provide the key |
| Auth token | \`generateAuthToken\`, \`decryptAuthToken\` | Loaded automatically from env vars |

**All exports**
\`\`\`ts
import {
  // Core JWT
  jwtSign, jwtVerify,
  // Core JWE
  jweEncrypt, jweDecrypt,
  // Auth token (high-level)
  generateAuthToken, decryptAuthToken,
  // Key helpers
  toSymmetricSecret, toPKCS8Secret, toSPKISecret, toJWKSecret
} from '@qnx/crypto'
\`\`\`

> **Note:** \`jwtVerify\` is re-exported directly from \`jose\` — same API, no wrapper.`,

    setup: `## Key Setup

\`generateAuthToken\` and \`decryptAuthToken\` need two P-256 key pairs: one to sign the JWT and one to encrypt the JWE.

### Generate keys with Node.js

Save as \`generate-keys.mjs\`, then run \`node generate-keys.mjs >> .env\`. Keep \`.env\` out of git.

\`\`\`js
import { generateKeyPairSync } from 'node:crypto'

const pair = () => generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
})

// Stores each PEM on one line, with \\n for its line breaks
const line = (name, pem) => \`\${name}="\${pem.trim().replaceAll('\\n', '\\\\n')}"\`

const jwt = pair()
const jwe = pair()
console.log(line('JWT_PRIVATE_KEY', jwt.privateKey))
console.log(line('JWT_PUBLIC_KEY', jwt.publicKey))
console.log(line('JWE_PRIVATE_KEY', jwe.privateKey))
console.log(line('JWE_PUBLIC_KEY', jwe.publicKey))
\`\`\`

### Or with OpenSSL

Run this once for \`jwt\` and once for \`jwe\`. The \`pkcs8\` step matters: \`BEGIN EC PRIVATE KEY\` output can't be imported.

\`\`\`bash
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out jwt-private.pem
openssl ec -in jwt-private.pem -pubout -out jwt-public.pem
\`\`\`

For HMAC, a random secret works: \`openssl rand -base64 48\`.

### Environment variables

| Variable | Used by |
| --- | --- |
| \`JWT_PRIVATE_KEY\`, \`JWE_PUBLIC_KEY\` | \`generateAuthToken\` |
| \`JWT_PUBLIC_KEY\`, \`JWE_PRIVATE_KEY\` | \`decryptAuthToken\` |

The keys are read on first use and then cached, so load \`.env\` before that first call.

### Line breaks in PEM values

A PEM value must reach the library with real line breaks. A literal backslash-n fails with \`Invalid character\`, or on Node 26 with \`Found a character that cannot be part of a valid base64 string\`.

- **\`.env\` file:** keep the value in double quotes. \`dotenv\` and \`node --env-file\` then turn \`\\n\` into line breaks.
- **Hosting dashboards and Docker:** these usually keep \`\\n\` literally, so convert it once at startup, before the first token call:

\`\`\`ts
for (const name of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'JWE_PRIVATE_KEY', 'JWE_PUBLIC_KEY']) {
  process.env[name] = process.env[name]?.replace(/\\\\n/g, '\\n')
}
\`\`\``,

    jwt: `## JWT — Sign & Verify

### \`jwtSign\`

Signs a JWT and returns the compact string.

**Signature**
\`\`\`ts
jwtSign(
  payload: JWTPayload,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: {
    alg?: string           // default: 'ES256', whatever the key was imported for
    jti?: string           // JWT ID
    subject?: string       // sub claim
    issuer?: string        // iss claim
    expirationTime?: string | number | Date  // e.g. '2h', '7d'
  }
): Promise<string>
\`\`\`

**With symmetric secret (HS256)**
\`\`\`ts
import { jwtSign, toSymmetricSecret } from '@qnx/crypto'

const secret = toSymmetricSecret(process.env.JWT_SECRET ?? '') // at least 32 bytes for HS256
const token = await jwtSign({ userId: 42 }, secret, {
  alg: 'HS256', // required: the default, ES256, can't use a symmetric secret
  subject: '42',
  expirationTime: '2h'
})
\`\`\`

**With asymmetric key (ES256)**
\`\`\`ts
import { jwtSign, toPKCS8Secret } from '@qnx/crypto'

const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY ?? '', 'ES256')
const token = await jwtSign({ userId: 42 }, privateKey, {
  subject: '42',
  issuer: 'https://yourapp.com',
  expirationTime: '7d'
})
\`\`\`

**With any other asymmetric algorithm (RS256)**

Pass \`alg\` to \`jwtSign\` as well as to the key import. Otherwise it signs with ES256 and throws \`CryptoKey does not support this operation\`.

\`\`\`ts
const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY ?? '', 'RS256')
const token = await jwtSign({ userId: 42 }, privateKey, { alg: 'RS256', expirationTime: '7d' })
\`\`\`

> A token signed without \`expirationTime\` never expires.

---

### \`jwtVerify\`

Verifies the JWT signature and claims. Re-exported from \`jose\`.

**Signature**
\`\`\`ts
jwtVerify(token: string, key: CryptoKey | KeyObject | JWK | Uint8Array): Promise<{ payload: JWTPayload, protectedHeader: ... }>
\`\`\`

**With symmetric secret**
\`\`\`ts
import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'

const secret = toSymmetricSecret(process.env.JWT_SECRET ?? '')
const { payload } = await jwtVerify(token, secret)
console.log(payload) // { userId: 42, sub: '42', iat: ..., exp: ... }
\`\`\`

**With asymmetric key**
\`\`\`ts
import { jwtVerify, toSPKISecret } from '@qnx/crypto'

const publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY ?? '', 'ES256')
const { payload } = await jwtVerify(token, publicKey)
\`\`\`

> Throws if the token is expired (\`JWTExpired\`), has an invalid signature (\`JWSSignatureVerificationFailed\`), or fails any claims check. See the troubleshooting topic.`,

    jwe: `## JWE — Encrypt & Decrypt

### \`jweEncrypt\`

Encrypts a plaintext string into a compact JWE.

**Signature**
\`\`\`ts
jweEncrypt(
  plaintext: string,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: { alg: string; enc: string }
): Promise<string>
\`\`\`

| Option | Default | Description |
| --- | --- | --- |
| \`alg\` | \`ECDH-ES+A128KW\` | Key agreement algorithm |
| \`enc\` | \`A256CBC-HS512\` | Content encryption algorithm |

> Each has a default at runtime, but the type requires both as soon as you pass \`options\`. Passing only one fails to compile with TS2345.

**Example**
\`\`\`ts
import { jweEncrypt, toSPKISecret } from '@qnx/crypto'

const publicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY ?? '', 'ECDH-ES+A128KW')
const jwe = await jweEncrypt('sensitive data', publicKey)
\`\`\`

---

### \`jweDecrypt\`

Decrypts a compact JWE and returns the plaintext string.

**Signature**
\`\`\`ts
jweDecrypt(
  jwe: string,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: DecryptOptions
): Promise<{ plaintext: string; protectedHeader: CompactJWEHeaderParameters }>
\`\`\`

**Example**
\`\`\`ts
import { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'

const privateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY ?? '', 'ECDH-ES+A128KW')
const { plaintext } = await jweDecrypt(jwe, privateKey)
console.log(plaintext) // 'sensitive data'
\`\`\`

> \`jweDecrypt\` decodes the Uint8Array output from \`compactDecrypt\` back to a string automatically — you get a plain \`string\`, not a \`Uint8Array\`.`,

    'auth-token': `## Auth Token (High-Level)

High-level helpers that combine JWT + JWE. Keys are loaded automatically from environment variables: see the setup topic to generate them.

> **These tokens never expire.** The payload holds only \`iat\`, \`jti\` and \`sub\`, with no \`exp\`, and \`generateAuthToken\` has no option to add one. \`decryptAuthToken\` accepts an old token for as long as the keys are valid. Your database check on \`jti\` is the only thing that can end a session, so store an expiry with it and check it on every request. See get-guide with topic auth-session for working code.

### Environment Variables (required)

\`\`\`bash
JWT_PRIVATE_KEY=<ES256 PKCS8 PEM>   # used to sign the JWT
JWT_PUBLIC_KEY=<ES256 SPKI PEM>     # used to verify the JWT
JWE_PUBLIC_KEY=<ECDH-ES+A128KW SPKI PEM>   # used to encrypt the JWE
JWE_PRIVATE_KEY=<ECDH-ES+A128KW PKCS8 PEM> # used to decrypt the JWE
\`\`\`

---

### \`generateAuthToken\`

Signs a JWT with the subject, then encrypts it as a JWE. Returns both the encrypted token and a UUID for DB storage.

**Signature**
\`\`\`ts
generateAuthToken(subject: string): Promise<{ token: string; dbToken: string }>
\`\`\`

| Return field | Description |
| --- | --- |
| \`token\` | The JWE-encrypted token — send this to the client |
| \`dbToken\` | A UUID (JWT ID / \`jti\`) — store this in the database to track/revoke sessions |

**Example**
\`\`\`ts
import { generateAuthToken } from '@qnx/crypto'

const { token, dbToken } = await generateAuthToken(userId.toString())

// Store dbToken in DB, send token to client
await db.sessions.create({ jti: dbToken, userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
res.cookie('auth', token, { httpOnly: true, secure: true, sameSite: 'lax' })
\`\`\`

---

### \`decryptAuthToken\`

Decrypts the JWE, then verifies the inner JWT. Returns the JWT payload.


**Signature**
\`\`\`ts
decryptAuthToken(jwe: string): Promise<JWTPayload>
\`\`\`

**Example**
\`\`\`ts
import { decryptAuthToken } from '@qnx/crypto'
import { UnauthenticatedUserError } from '@qnx/errors'

let payload
try {
  payload = await decryptAuthToken(req.cookies.auth)
} catch (error) {
  // Token is invalid or tampered. It can't be expired here: it has no exp claim.
  throw new UnauthenticatedUserError('Invalid auth token')
}

// The only check that can end a session
const session = await db.sessions.findByJti(payload.jti)
if (!session || session.expiresAt < new Date()) {
  throw new UnauthenticatedUserError('Session expired')
}
const userId = payload.sub   // the subject passed to generateAuthToken
\`\`\`

---

### Flow

\`\`\`
generateAuthToken(subject)
  → jwtSign({}, jwtPrivateKey, { jti, subject })   // creates JWT
  → jweEncrypt(jwt, jwePublicKey)                   // wraps JWT in JWE
  → returns { token: jwe, dbToken: jti }

decryptAuthToken(jwe)
  → jweDecrypt(jwe, jwePrivateKey)                  // unwraps JWE → JWT string
  → jwtVerify(jwt, jwtPublicKey)                    // verifies JWT
  → returns payload { sub, jti, iat }
\`\`\``,

    'key-helpers': `## Key Helpers

Utility functions to convert raw key material into the format expected by \`jwtSign\`, \`jwtVerify\`, \`jweEncrypt\`, and \`jweDecrypt\`.

### \`toSymmetricSecret\`

Encodes a plain string into a \`Uint8Array\` for use as a symmetric secret.

\`\`\`ts
import { toSymmetricSecret } from '@qnx/crypto'

const secret = toSymmetricSecret(process.env.JWT_SECRET ?? '')
// Returns: Uint8Array — pass directly to jwtSign / jwtVerify
\`\`\`

| Use with | Secret length |
| --- | --- |
| \`HS256\`, \`HS384\`, \`HS512\` JWTs | At least 32, 48 or 64 bytes (RFC 7518). jose accepts shorter secrets, but they're weaker |
| \`A128KW\`, \`A192KW\`, \`A256KW\` JWEs | Exactly 16, 24 or 32 bytes, or encryption throws |

> Don't use it for asymmetric algorithms such as ES256 or ECDH-ES. Don't write a real secret in your source.

---

### \`toPKCS8Secret\`

Imports a PKCS8 PEM private key. Alias for \`jose.importPKCS8\`.

\`\`\`ts
import { toPKCS8Secret } from '@qnx/crypto'

const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY ?? '', 'ES256')
// or for JWE decryption:
const jwePrivateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY ?? '', 'ECDH-ES+A128KW')
\`\`\`

---

### \`toSPKISecret\`

Imports a SPKI PEM public key. Alias for \`jose.importSPKI\`.

\`\`\`ts
import { toSPKISecret } from '@qnx/crypto'

const publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY ?? '', 'ES256')
// or for JWE encryption:
const jwePublicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY ?? '', 'ECDH-ES+A128KW')
\`\`\`

---

### \`toJWKSecret\`

Imports a JWK (JSON Web Key). Alias for \`jose.importJWK\`.

\`\`\`ts
import { toJWKSecret } from '@qnx/crypto'

const key = await toJWKSecret({ kty: 'EC', crv: 'P-256', ... })
\`\`\`

---

### Summary

| Helper | Input | Use with |
| --- | --- | --- |
| \`toSymmetricSecret\` | Plain string | \`jwtSign\` / \`jwtVerify\` (HS256), \`jweEncrypt\` / \`jweDecrypt\` (A256KW) |
| \`toPKCS8Secret\` | PKCS8 PEM string | \`jwtSign\` (private), \`jweDecrypt\` (private) |
| \`toSPKISecret\` | SPKI PEM string | \`jwtVerify\` (public), \`jweEncrypt\` (public) |
| \`toJWKSecret\` | JWK object | Any operation with a JWK key |`,

    algorithms: `## Algorithms

### JWT Algorithms

| Algorithm | Type | Key helper | Use when |
| --- | --- | --- | --- |
| \`HS256\` | Symmetric HMAC | \`toSymmetricSecret\` | Same party signs and verifies (e.g. internal services) |
| \`HS384\` | Symmetric HMAC | \`toSymmetricSecret\` | Same as HS256, stronger hash |
| \`HS512\` | Symmetric HMAC | \`toSymmetricSecret\` | Same as HS256, strongest hash |
| \`ES256\` *(default)* | Asymmetric EC | \`toPKCS8Secret\` / \`toSPKISecret\` | Different parties sign (private) and verify (public) |
| \`RS256\` | Asymmetric RSA | \`toPKCS8Secret\` / \`toSPKISecret\` | RSA alternative to ES256 |

### JWE Algorithms

| Option | Default | Description |
| --- | --- | --- |
| \`alg\` (key wrap) | \`ECDH-ES+A128KW\` | Key agreement + wrapping algorithm |
| \`enc\` (content) | \`A256CBC-HS512\` | Content encryption algorithm |

**Common \`alg\` values**
| Algorithm | Key type |
| --- | --- |
| \`ECDH-ES+A128KW\` *(default)* | EC key pair (SPKI to encrypt, PKCS8 to decrypt) |
| \`A128KW\` / \`A256KW\` | Symmetric AES key |
| \`RSA-OAEP\` | RSA key pair |

**Common \`enc\` values**
| Algorithm | Description |
| --- | --- |
| \`A256CBC-HS512\` *(default)* | AES-256-CBC + HMAC-SHA-512 |
| \`A128GCM\` / \`A256GCM\` | AES-GCM authenticated encryption |`,

    troubleshooting: `## Troubleshooting

Paste the exact error into the \`diagnose-error\` tool for its cause and fix. The common ones:

| Error | Usual cause |
| --- | --- |
| \`JWT private key is not found in environment variables.\` (or public, or JWE) | The variable isn't set when the first token call runs. See setup |
| \`Invalid character\`, or on Node 26 \`Found a character that cannot be part of a valid base64 string\` | A PEM has literal \`\\n\` instead of line breaks. See setup |
| \`Invalid keyData\` | The PEM's content was cut short or changed. Copy it again |
| \`Invalid key length\` | A JWE secret isn't exactly 16, 24 or 32 bytes for A128KW, A192KW or A256KW |
| \`"pkcs8" must be PKCS#8 formatted string\` | The key is a public key, or \`BEGIN EC PRIVATE KEY\` rather than \`BEGIN PRIVATE KEY\` |
| \`Named curve mismatch\` | The key's curve doesn't match the algorithm, such as a P-384 key with ES256 |
| \`Key for the ES256 algorithm must be...\` | A symmetric secret without \`alg: 'HS256'\` |
| \`CryptoKey does not support this operation\` | \`alg\` wasn't passed to \`jwtSign\`, so it used ES256 with another type of key |
| \`JOSENotSupported\` | The algorithm doesn't suit the key helper, or isn't supported at all, such as \`none\` |
| \`Invalid time period format\` | \`expirationTime\` isn't a value like \`2h\`, \`7d\` or \`30m\` |
| \`JWTExpired\` / \`ERR_JWT_EXPIRED\` | The token passed its \`exp\` time. Issue a new one |
| \`JWSSignatureVerificationFailed\` | The token was changed or was signed with a different key |
| \`JWEDecryptionFailed\` / \`ERR_JWE_DECRYPTION_FAILED\` | The token was changed or was encrypted for a different key |
| \`ERR_MODULE_NOT_FOUND\` for \`uuid\` or \`jose\` | The peer dependencies aren't installed |`
}

export function registerCryptoDocsTool(server: McpServer) {
    server.registerTool(
        'get-crypto-docs',
        {
            ...readOnlyTool('@qnx/crypto docs'),
            description: 'Get documentation for @qnx/crypto — auth token generation and JWT/JWE helpers built on jose. Use generateAuthToken/decryptAuthToken for session management, or the core jwtSign/jwtVerify/jweEncrypt/jweDecrypt functions for custom flows. Includes key generation (setup) and error messages (troubleshooting). Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe(
                    'overview | setup | jwt | jwe | auth-token | key-helpers | algorithms | troubleshooting | all'
                )
            }
        },
        async ({ topic }) => textResult(
            topic === 'all'
                ? ['# `@qnx/crypto` Reference\n', ...Object.values(cryptoDocs)].join('\n\n---\n\n')
                : cryptoDocs[topic]
        )
    )
}
