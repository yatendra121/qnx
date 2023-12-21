# @qnx/crypto

@qnx/crypto provides utility functions to generate and decrypt JSON Web Encrypt (JWEs) using elliptic curve cryptography for secure authentication.

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

## Setup

Ensure you have the necessary environment variables set:

```bash
ENCRYPTION_SECRET_JWT: The secret key used for JWT signing
ENCRYPTION_SECRET_JWE: The secret key used for JWT encryption
```

## Usage

### Generating Tokens

The generateToken function creates a JWT for authentication purposes.

```javascript
import { generateToken } from '@qnx/crypto'

const subject = 'userId'
const { token, dbToken } = await generateToken(subject)
// token: The encrypted JWT token
// dbToken: The unique identifier associated with the token
```

Decrypting Tokens
The decryptToken function decrypts a JWT token and verifies its authenticity.

```javascript
import { decryptToken } from '@qnx/crypto'

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

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
