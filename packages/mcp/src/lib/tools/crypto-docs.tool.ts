import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const topics = ['overview', 'jwt', 'jwe', 'auth-token', 'key-helpers', 'algorithms', 'all'] as const

const docs: Record<Exclude<typeof topics[number], 'all'>, string> = {
    overview: `## Overview

\`@qnx/crypto\` provides JWT signing/verification and JWE encryption/decryption built on the [jose](https://github.com/panva/jose) library.

**Installation**
\`\`\`bash
npm install @qnx/crypto jose
\`\`\`

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

    jwt: `## JWT — Sign & Verify

### \`jwtSign\`

Signs a JWT and returns the compact string.

**Signature**
\`\`\`ts
jwtSign(
  payload: JWTPayload,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: {
    alg?: string           // default: 'ES256'
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

const secret = toSymmetricSecret('your-secret-string')
const token = await jwtSign({ userId: 42 }, secret, {
  alg: 'HS256',
  subject: '42',
  expirationTime: '2h'
})
\`\`\`

**With asymmetric key (ES256)**
\`\`\`ts
import { jwtSign, toPKCS8Secret } from '@qnx/crypto'

const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY, 'ES256')
const token = await jwtSign({ userId: 42 }, privateKey, {
  subject: '42',
  issuer: 'https://yourapp.com',
  expirationTime: '7d'
})
\`\`\`

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

const secret = toSymmetricSecret('your-secret-string')
const { payload } = await jwtVerify(token, secret)
console.log(payload) // { userId: 42, sub: '42', iat: ..., exp: ... }
\`\`\`

**With asymmetric key**
\`\`\`ts
import { jwtVerify, toSPKISecret } from '@qnx/crypto'

const publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY, 'ES256')
const { payload } = await jwtVerify(token, publicKey)
\`\`\`

> Throws if the token is expired, has an invalid signature, or fails any claims check.`,

    jwe: `## JWE — Encrypt & Decrypt

### \`jweEncrypt\`

Encrypts a plaintext string into a compact JWE.

**Signature**
\`\`\`ts
jweEncrypt(
  plaintext: string,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: { alg?: string; enc?: string }
): Promise<string>
\`\`\`

| Option | Default | Description |
| --- | --- | --- |
| \`alg\` | \`ECDH-ES+A128KW\` | Key agreement algorithm |
| \`enc\` | \`A256CBC-HS512\` | Content encryption algorithm |

**Example**
\`\`\`ts
import { jweEncrypt, toSPKISecret } from '@qnx/crypto'

const publicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY, 'ECDH-ES+A128KW')
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

const privateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY, 'ECDH-ES+A128KW')
const { plaintext } = await jweDecrypt(jwe, privateKey)
console.log(plaintext) // 'sensitive data'
\`\`\`

> \`jweDecrypt\` decodes the Uint8Array output from \`compactDecrypt\` back to a string automatically — you get a plain \`string\`, not a \`Uint8Array\`.`,

    'auth-token': `## Auth Token (High-Level)

High-level helpers that combine JWT + JWE. Keys are loaded automatically from environment variables.

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
await db.sessions.create({ jti: dbToken, userId })
res.cookie('auth', token, { httpOnly: true })
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

try {
  const payload = await decryptAuthToken(req.cookies.auth)
  const userId = payload.sub   // the subject passed to generateAuthToken
  const jti = payload.jti      // match this against your DB to validate the session
} catch (error) {
  // Token is invalid, expired, or tampered
  throw new UnauthenticatedUserError('Invalid auth token')
}
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
  → returns payload { sub, jti, iat, ... }
\`\`\``,

    'key-helpers': `## Key Helpers

Utility functions to convert raw key material into the format expected by \`jwtSign\`, \`jwtVerify\`, \`jweEncrypt\`, and \`jweDecrypt\`.

### \`toSymmetricSecret\`

Encodes a plain string into a \`Uint8Array\` for use as an HMAC symmetric secret (e.g. HS256).

\`\`\`ts
import { toSymmetricSecret } from '@qnx/crypto'

const secret = toSymmetricSecret('my-secret-string')
// Returns: Uint8Array — pass directly to jwtSign / jwtVerify
\`\`\`

> Use for symmetric JWT (HS256, HS384, HS512). Do NOT use for JWE or asymmetric JWT.

---

### \`toPKCS8Secret\`

Imports a PKCS8 PEM private key. Alias for \`jose.importPKCS8\`.

\`\`\`ts
import { toPKCS8Secret } from '@qnx/crypto'

const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY, 'ES256')
// or for JWE decryption:
const jwePrivateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY, 'ECDH-ES+A128KW')
\`\`\`

---

### \`toSPKISecret\`

Imports a SPKI PEM public key. Alias for \`jose.importSPKI\`.

\`\`\`ts
import { toSPKISecret } from '@qnx/crypto'

const publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY, 'ES256')
// or for JWE encryption:
const jwePublicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY, 'ECDH-ES+A128KW')
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
| \`toSymmetricSecret\` | Plain string | \`jwtSign\` / \`jwtVerify\` (HS256) |
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
| \`A128GCM\` / \`A256GCM\` | AES-GCM authenticated encryption |`
}

export function registerCryptoDocsTool(server: McpServer) {
    server.registerTool(
        'get-crypto-docs',
        {
            description: 'Get documentation for @qnx/crypto — auth token generation and JWT/JWE helpers built on jose. Use generateAuthToken/decryptAuthToken for session management, or the core jwtSign/jwtVerify/jweEncrypt/jweDecrypt functions for custom flows. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe(
                    'overview | jwt | jwe | auth-token | key-helpers | algorithms | all'
                )
            }
        },
        async ({ topic }) => {
            let text: string

            if (topic === 'all') {
                text = [
                    '# `@qnx/crypto` Reference\n',
                    docs.overview,
                    docs.jwt,
                    docs.jwe,
                    docs['auth-token'],
                    docs['key-helpers'],
                    docs.algorithms
                ].join('\n\n---\n\n')
            } else {
                text = docs[topic]
            }

            return {
                content: [{ type: 'text', text }]
            }
        }
    )
}
