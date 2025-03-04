# @qnx/crypto

`@qnx/crypto` provides utility functions to generate and decrypt JSON Web Signatures (JWS) and JSON Web Encryption (JWE) using the [jose](https://www.npmjs.com/package/jose) cryptography library for secure data transmission.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/crypto.

```bash
npm install @qnx/crypto
```

You can also use [yarn](https://yarnpkg.com/) & [pnpm](https://pnpm.io/)

```bash
yarn add @qnx/crypto
```

```bash
pnpm install @qnx/crypto
```

#### Peer-Dependencies

@qnx/crypto is using [JOSE](https://github.com/panva/jose).

```bash
npm install jose
```

## Usage

### Core functions

- jwtSign
- jwtVerify
- jweEncrypt
- jweDecrypt

**jwtSign:** Signs and returns the JWT.

```javascript
import { jwtSign, toSymmetricSecret } from '@qnx/crypto'

const dataVal = {
  foo: 'bar'
}
const jwt = await jwtSign({ data: dataVal }, toSymmetricSecret('SECRET_STRING'), {
  alg: 'HS256'
})
```

**jwtVerify:** Verifies the JWT format, signature, and claims set.

```javascript
import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'

const { payload } = await jwtVerify(jwt, toSymmetricSecret('SECRET_STRING'))
```

**jweEncrypt:** Encrypts a value of the JWE string.

```javascript
import { jweEncrypt, toPKCS8Secret } from '@qnx/crypto'

const secret = await toPKCS8Secret(process.env['ENCRYPTION_SECRET_JWE'], 'ECDH-ES+A128KW')
const dataVal = 'this is message.'
const jwe = await jweEncrypt(dataVal, secret)
```

**jweDecrypt:** Decrypts a JWE.

```javascript
import { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'

const secret = await toPKCS8Secret(process.env['ENCRYPTION_SECRET_JWE'], 'ECDH-ES+A128KW')
const jwe = 'JWE_TOKEN'
const { plaintext } = await jweDecrypt(jwe, secret)
```

### JWE Authentication Token

#### Setup

Ensure you have the necessary environment variables set:

```bash
ENCRYPTION_SECRET_JWT: The secret key used for JWT signing
ENCRYPTION_SECRET_JWE: The secret key used for JWT encryption
```

### Generate Auth Token

**generateAuthToken:** Creates a JWE for authentication purposes.

```javascript
import { generateAuthToken } from '@qnx/crypto'

const subject = 'userId'
const { token, dbToken } = await generateToken(subject)
// token: The encrypted JWT token
// dbToken: The unique identifier associated with the token
```

### Decrypt Auth Token

**decryptToken:** Decrypts a JWE token and verifies its authenticity.

```javascript
import { decryptAuthToken } from '@qnx/crypto'

const encryptedToken = '...' // Replace with the encrypted token
try {
  const decryptedPayload = await decryptToken(encryptedToken)
  // decryptedPayload: The decoded payload from the token
} catch (error) {
  // Handle decryption errors
  console.error('Token decryption failed:', error)
}
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
