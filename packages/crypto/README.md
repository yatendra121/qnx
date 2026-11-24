# @qnx/crypto

`@qnx/crypto` provides utility functions to generate and decrypt JSON Web Signatures (JWS) and JSON Web Encryption (JWE) using the [jose](https://www.npmjs.com/package/jose) cryptography library for secure data transmission.

> 🤖 MCP Server: `https://qnx-mcp-server.vercel.app/mcp/crypto`

> **Node.js:** `jose` is ESM-only, so `require('@qnx/crypto')` needs Node.js 20.19+ or 22.12+. `import` has no such limit.

## ✨ Features

- 🔐 JWT signing and verification
- 🔒 JWE encryption and decryption
- 🔁 Auth token generator/decryptor
- 🗝️ Key generator for auth tokens, with a public JWKS
- 📦 Built on the [JOSE](https://github.com/panva/jose) standard

## 📦 Installation

```bash
# npm
npm install @qnx/crypto

# yarn
yarn add @qnx/crypto

# pnpm
pnpm install @qnx/crypto
```

### Peer Dependencies

```bash
npm install jose uuid
```

## 🚀 Usage

### Core Functions

| Function     | Purpose                  |
| ------------ | ------------------------ |
| `jwtSign`    | Sign a JWT payload       |
| `jwtVerify`  | Verify a JWT token       |
| `jweEncrypt` | Encrypt a payload to JWE |
| `jweDecrypt` | Decrypt a JWE token      |

### `jwtSign`

Signs and returns a JWT using a symmetric secret.

```ts
import { jwtSign, toSymmetricSecret } from '@qnx/crypto'

const data = { foo: 'bar' }
const secret = toSymmetricSecret('SECRET_STRING')

const jwt = await jwtSign({ data }, secret, { alg: 'HS256' })
```

### `jwtVerify`

Verifies the JWT format, signature, and claims set.

```ts
import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'

const secret = toSymmetricSecret('SECRET_STRING')
const { payload } = await jwtVerify(jwt, secret)
```

### `jweEncrypt`

Encrypts a string using JWE.

```ts
import { jweEncrypt, toPKCS8Secret } from '@qnx/crypto'

const secret = await toPKCS8Secret(process.env.ENCRYPTION_SECRET_JWE, 'ECDH-ES+A128KW')
const jwe = await jweEncrypt('this is message.', secret)
```

### `jweDecrypt`

Decrypts a previously encrypted JWE string.

```ts
import { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'

const secret = await toPKCS8Secret(process.env.ENCRYPTION_SECRET_JWE, 'ECDH-ES+A128KW')
const { plaintext } = await jweDecrypt(jwe, secret)
```

---

## 🔐 Auth Token Management

### Environment Setup

`generateAuthToken` and `decryptAuthToken` read two key pairs from these environment variables. One pair signs the JWT inside the token and the other encrypts it.

| Variable          | Value                                   | Used by             |
| ----------------- | --------------------------------------- | ------------------- |
| `JWT_PRIVATE_KEY` | PKCS8 PEM                               | `generateAuthToken` |
| `JWE_PUBLIC_KEY`  | SPKI PEM                                | `generateAuthToken` |
| `JWT_PUBLIC_KEY`  | SPKI PEM                                | `decryptAuthToken`  |
| `JWE_PRIVATE_KEY` | PKCS8 PEM                               | `decryptAuthToken`  |
| `JWT_ALG`         | Optional. Signing algorithm, default `ES256`             | both |
| `JWE_ALG`         | Optional. Encryption algorithm, default `ECDH-ES+A128KW` | both |

The keys are read on first use and then cached, so load your `.env` before the first call. `decryptAuthToken` only accepts tokens made with `JWT_ALG` and `JWE_ALG`. `JWT_ALG` and `JWE_ALG` are read from 0.8.19. Earlier versions always use the defaults.

### Generate the keys

Run this in your project:

```bash
npx @qnx/crypto generate-keys
```

It asks four questions. Press Enter to take the recommended answer:

```text
  qnx-crypto  Keys for auth tokens

  ? Signing
    1  ES256  recommended
    2  ES384
    3  ES512
    4  EdDSA
  › 1-4, Enter for ES256
```

Each answer then shrinks to one line, so at the end you see:

```text
  ✔ Signing       ES256
  ✔ Encryption    ECDH-ES+A128KW
  ✔ Save keys to  .env.keys
  ✔ Public JWKS   jwks.json

  ✔ Keys created (ES256, ECDH-ES+A128KW)

    .env.keys  private keys, copy them into your .env
    jwks.json  public keys, safe to share
```

Copy the lines from `.env.keys` into your `.env`. Each key keeps its line breaks inside double quotes, which `dotenv`, `node --env-file` and Vite read correctly.

- `.env.keys` is created readable only by you. You get a warning if git doesn't ignore it.
- Before overwriting a file, it asks you, and the default answer is no.
- Type `-` at "Save keys to" to print the lines instead. Use `--jwks <file>` for another JWKS file name.
- Colors are turned off by [`NO_COLOR`](https://no-color.org).
- Ctrl+C stops it without writing anything.

The JWKS has the signing key (`use: "sig"`) and the encryption key (`use: "enc"`), each with its `alg` and a `kid`, the key's [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) thumbprint. It never contains private keys, so you can publish it, for example at `/.well-known/jwks.json`.

> ⚠️ Keep the private keys out of git. If they were ever committed, generate new ones. Tokens made with the old keys stop working once you switch.

#### In scripts and CI

Without a terminal, or with `--yes`, it asks nothing. It uses the flags you pass and the defaults for the rest, and prints the lines:

```bash
npx @qnx/crypto generate-keys --yes > .env.keys
npx @qnx/crypto generate-keys --yes --jwt-alg EdDSA --out .env.keys --jwks jwks.json
```

| Option            | Default                         | Effect |
| ----------------- | ------------------------------- | ------ |
| `--jwt-alg <alg>` | `ES256`                         | `ES256`, `ES384`, `ES512` or `EdDSA` |
| `--jwe-alg <alg>` | `ECDH-ES+A128KW`                | `ECDH-ES+A128KW` or `ECDH-ES+A256KW` |
| `--out <file>`    | Printed (`-`)                   | Where to write the `.env` lines |
| `--jwks <file>`   | None                            | Also write the public JWKS |
| `--no-jwks`       |                                 | Don't write a JWKS, and don't ask |
| `--force`         |                                 | Overwrite existing files |
| `-y`, `--yes`     |                                 | Don't ask anything |

A flag also skips its question in a terminal.

#### In code

```ts
import { generateAuthKeys, formatAuthKeyEnv } from '@qnx/crypto'

const { env, jwks } = await generateAuthKeys({ jwtAlg: 'ES256', jweAlg: 'ECDH-ES+A128KW' })
// env: JWT_ALG, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWE_ALG, JWE_PRIVATE_KEY and JWE_PUBLIC_KEY
// jwks: { keys: [signingKey, encryptionKey] }, public keys only
console.log(formatAuthKeyEnv(env)) // the same .env lines as the command
```

Both options are optional. The allowed values are in `authTokenSigningAlgorithms` and `authTokenEncryptionAlgorithms`, recommended first.

### `generateAuthToken`

Creates a signed and encrypted auth token.

```ts
import { generateAuthToken } from '@qnx/crypto'

const { token, dbToken } = await generateAuthToken('userId')

// token   — encrypted token to send to the client
// dbToken — unique identifier to store in the database
```

### `decryptAuthToken`

Decrypts and verifies the encrypted auth token.

```ts
import { decryptAuthToken } from '@qnx/crypto'

try {
  const payload = await decryptAuthToken(token)
  // use the decrypted payload
} catch (error) {
  console.error('Token decryption failed:', error)
}
```

---

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/crypto`

| Tool | Description |
| ---- | ----------- |
| `get-crypto-docs` | Documentation for JWT, JWE, auth token helpers, key helpers, and supported algorithms |
| `build-crypto-snippet` | Generate a TypeScript snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

### HTTP (Streamable HTTP)

```json
{
  "mcpServers": {
    "qnx-crypto": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/crypto"
    }
  }
}
```

### stdio (via npx)

```json
{
  "mcpServers": {
    "qnx-crypto": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp", "crypto"]
    }
  }
}
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
