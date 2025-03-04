# @qnx/client

@qnx/client is providing components to simplify your codes.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/client.

```bash
npm install @qnx/client
```

You can also use [yarn](https://yarnpkg.com/) & [pnpm](https://pnpm.io/)

```bash
yarn add @qnx/client
```

```bash
pnpm install @qnx/client
```

## Usage

```javascript
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

```javascript
import { ApiSuccessResponse } from '@qnx/client'

const res = {
  data: 10,
  message: 'Request successful.'
}

const apiRes = ApiSuccessResponse(res)

const data = apiRes.getData()
const message = apiRes.getMessage()
```

```javascript
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

```javascript
// ApiResponseValue
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

```javascript
// ApiResponseValue
import type { ApiSuccessResponseValue } from '@qnx/client'

const successResponse: ApiSuccessResponseValue<number> = {
  data: 10,
  message: 'Request successful.'
}
```

```javascript
// ApiErrorResponseValue
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

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/client/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
