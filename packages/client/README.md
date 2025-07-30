# `@qnx/client`

`@qnx/client` provides utility classes and types to help standardize and simplify handling of API responses on the client side. It supports typed access to data, messages, and errors from server responses.

## ✨ Features

- Typed wrappers for API responses
- Easy parsing of both success and error responses
- Works well with any REST API response structure
- Improves code readability and error handling consistency

## 📦 Installation

You can install via your preferred package manager:

```bash
# npm
npm install @qnx/client

# yarn
yarn add @qnx/client

# pnpm
pnpm install @qnx/client
```

## 🚀 Usage

### General API Response

```ts
import { ApiResponse } from '@qnx/client'

const res = {
  data: 10,
  errorCode: 'ERR002',
  error: 'An error occurred',
  errors: {
    field1: ['Error message 1', 'Error message 2'],
    field2: ['Error message 3']
  },
  message: 'Request successful.',
  serverError: {
    code: 500,
    message: 'Internal server error'
  }
}

const apiRes = ApiResponse(res)

const data = apiRes.getData()
const message = apiRes.getMessage()
const errors = apiRes.getErrors()
const error = apiRes.getError()
const errorCode = apiRes.getErrorCode()
```

### Success Response

```ts
import { ApiSuccessResponse } from '@qnx/client'

const res = {
  data: 10,
  message: 'Request successful.'
}

const apiRes = ApiSuccessResponse(res)

const data = apiRes.getData()
const message = apiRes.getMessage()
```

### Error Response

```ts
import { ApiErrorResponse } from '@qnx/client'

const res = {
  errorCode: 'ERR002',
  error: 'An error occurred',
  errors: {
    field1: ['Error message 1', 'Error message 2'],
    field2: ['Error message 3']
  }
}

const apiRes = ApiErrorResponse(res)

const errors = apiRes.getErrors()
const error = apiRes.getError()
const errorCode = apiRes.getErrorCode()
```

### Types

#### ApiResponseValue

```ts
import type { ApiResponseValue } from '@qnx/client'

const response: ApiResponseValue<number> = {
  data: 10,
  errorCode: 'ERR002',
  error: 'An error occurred',
  errors: {
    field1: ['Error message 1', 'Error message 2'],
    field2: ['Error message 3']
  },
  message: 'Request successful.',
  serverError: {
    code: 500,
    message: 'Internal server error'
  }
}
```

#### ApiSuccessResponseValue

```ts
import type { ApiSuccessResponseValue } from '@qnx/client'

const successResponse: ApiSuccessResponseValue<number> = {
  data: 10,
  message: 'Request successful.'
}
```

#### ApiErrorResponseValue

```ts
import type { ApiErrorResponseValue } from '@qnx/client'

const errorResponse: ApiErrorResponseValue = {
  errors: {
    field1: ['Error message 1', 'Error message 2'],
    field2: ['Error message 3']
  },
  error: 'An error occurred',
  errorCode: 'ERR002'
}
```

## 🤝 Contributing

Pull requests are welcome!  
For major changes, please open an issue first to discuss your proposed updates.  
Ensure tests are updated for any feature changes.

## 📄 License

[MIT License](https://github.com/yatendra121/client/blob/main/LICENSE.md) © 2023–PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
