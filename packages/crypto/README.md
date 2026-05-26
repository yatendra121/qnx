# @qnx/crypto

`@qnx/crypto` provides utility functions to generate and decrypt JSON Web Signatures (JWS) and JSON Web Encryption (JWE) using the [jose](https://www.npmjs.com/package/jose) cryptography library for secure data transmission.

> 🤖 MCP Server: `https://qnx-mcp-server.vercel.app/mcp/crypto`

## ✨ Features

- 🔐 JWT signing and verification
- 🔒 JWE encryption and decryption
- 🔁 Auth token generator/decryptor
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

### Peer Dependency

```bash
npm install jose
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

```bash
ENCRYPTION_SECRET_JWT=your_jwt_secret
ENCRYPTION_SECRET_JWE=your_jwe_secret
```

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
