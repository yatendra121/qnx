# @qnx/errors

`@qnx/errors` provides a set of custom error classes to help you simplify and standardize error handling in your JavaScript/TypeScript applications.

> 🤖 MCP Server: `https://qnx-mcp-server.vercel.app/mcp/errors`

---

## 📑 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
  - [InvalidValueError](#invalidvalueerror)
  - [ValidationError](#validationerror)
  - [ApiResponseErrorsValue](#apiresponseerrorsvalue)
  - [UnauthenticatedUserError](#unauthenticatedusererror)
  - [ServerError](#servererror)
  - [ApiError](#apierror)
  - [Custom error classes](#custom-error-classes)
  - [Handling errors](#handling-errors)
  - [Using with @qnx/response](#using-with-qnxresponse)
- [Customizing Error Codes](#-customizing-error-codes)
- [Error Class Reference](#-error-class-reference)
- [MCP Server](#-mcp-server)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

| Feature | Description |
| ------- | ----------- |
| 🎯 **Typed errors** | Each scenario has its own class — no guessing what went wrong |
| 📦 **Consistent API** | Every class has the same `getCode()` and `getErrorResponse()` methods |
| ⚙️ **Configurable codes** | Default HTTP status codes work out of the box, override them if needed |
| 🔗 **Works with `@qnx/response`** | [Optional](#using-with-qnxresponse): it turns these errors into HTTP responses for you |

## 📦 Installation

```bash
npm install @qnx/errors

# yarn
yarn add @qnx/errors

# pnpm
pnpm add @qnx/errors
```

The package has no dependencies.

---

## 💡 Usage

### `InvalidValueError`

Use when a single field is invalid. Pass the field name as `key`, and the message becomes that field's error.

```ts
import { InvalidValueError } from '@qnx/errors'

const error = new InvalidValueError('User not found.', { key: 'id' })

error.getCode()          // 400
error.getErrorResponse() // { errors: { id: ['User not found.'] } }
```

---

### `ValidationError`

Use when multiple fields fail validation. Build the `errors` object and pass it as `errRes`.

```ts
import { ValidationError } from '@qnx/errors'

const error = new ValidationError('Validation failed', {
  errRes: {
    errors: {
      email: ['Email is required.'],
      password: ['Password must be at least 8 characters.']
    }
  }
})

error.getCode()          // 400
error.getErrorResponse() // { errors: { email: [...], password: [...] } }
```

---

### `ApiResponseErrorsValue`

A helper that collects field errors one at a time, so you don't have to build the `errors` object by hand. It isn't an error class, so you create it, add to it, and pass the result to `ValidationError`.

```ts
import { ApiResponseErrorsValue, ValidationError } from '@qnx/errors'

const errors = ApiResponseErrorsValue.getInstance()

if (!email) errors.addError('email', 'Email is required.')
if (password.length < 8) errors.addError('password', 'Must be at least 8 characters.')

if (errors.hasErrors()) {
  throw new ValidationError('Validation failed', { errRes: errors.getErrorResponse() })
}
```

If every check fails, `getErrorResponse()` returns:

```ts
{
  errors: {
    email: ['Email is required.'],
    password: ['Must be at least 8 characters.']
  }
}
```

---

### `UnauthenticatedUserError`

Use when a request is missing authentication or the token is invalid.

```ts
import { UnauthenticatedUserError } from '@qnx/errors'

const error = new UnauthenticatedUserError('Authentication required.')

error.getCode()          // 401
error.getErrorResponse() // undefined
```

---

### `ServerError`

Use for failures that the user cannot fix, such as a database being down or a third-party API being unreachable.

```ts
import { ServerError } from '@qnx/errors'

const error = new ServerError('Report generation failed.')

error.getCode()          // 500
error.getErrorResponse() // undefined
```

---

### `ApiError`

The base class. Use it when none of the above fit and you need a custom status code. The third argument is optional.

```ts
import { ApiError } from '@qnx/errors'

const error = new ApiError('Payment declined.', 402, {
  errRes: { errors: { card: ['Insufficient funds.'] } }
})

error.getCode()          // 402
error.getErrorResponse() // { errors: { card: ['Insufficient funds.'] } }

new ApiError('Conflict detected.', 409).getErrorResponse() // undefined
```

---

### Custom error classes

Extend `ApiError` to give a status code its own class. Set `name` yourself, otherwise it stays `'ApiError'`.

```ts
import { ApiError } from '@qnx/errors'

class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

new NotFoundError('User not found.').getCode() // 404
```

---

### Handling errors

The classes are ordinary `Error` subclasses, so you can check them with `instanceof`. Check the most specific class first, because they all extend `ApiError`.

```ts
import { ApiError, ValidationError } from '@qnx/errors'

try {
  await saveUser(input)
} catch (err) {
  if (err instanceof ValidationError) {
    console.error('Invalid fields:', err.getErrorResponse()?.errors)
  } else if (err instanceof ApiError) {
    console.error(`Failed with ${err.getCode()}: ${err.message}`)
  } else {
    throw err
  }
}
```

---

### Using with `@qnx/response`

Throw any of these errors inside `asyncValidatorHandler`, and [`@qnx/response`](https://github.com/yatendra121/qnx/tree/main/packages/response) sends the HTTP response for you. See [how thrown errors become responses](https://github.com/yatendra121/qnx/tree/main/packages/response#how-thrown-errors-become-responses) for the status and body of each class.

```ts
import { asyncValidatorHandler } from '@qnx/response'
import { InvalidValueError } from '@qnx/errors'

router.get('/users/:id', asyncValidatorHandler(async (req) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new InvalidValueError('User not found.', { key: 'id' })
  return user
}))
```

---

## ⚙️ Customizing Error Codes

Default HTTP status codes are `400` (validation), `401` (unauthenticated), and `500` (server error). Override them once at app startup with `setErrorCodes`:

```ts
import { setErrorCodes } from '@qnx/errors'

setErrorCodes({
  VALIDATION_ERROR_CODE: 422,
  UNAUTHENTICATED_USER_ERROR_CODE: 403,
  SERVER_ERROR_CODE: 503
})
```

Only the codes you pass change, and the others keep their current values.

The change applies to the whole process, so call it before any errors are created. Errors that already exist keep the code they were created with.

The current values are available as `errorCodes`:

```ts
import { errorCodes } from '@qnx/errors'

errorCodes.VALIDATION_ERROR_CODE // 422
```

---

## 📘 Error Class Reference

| Class | Constructor | HTTP Code | Use When |
| ----- | ----------- | --------- | -------- |
| `InvalidValueError` | `(message, { key })` | 400 | A single field is invalid |
| `ValidationError` | `(message, { errRes: { errors } })` | 400 | Multiple fields fail validation |
| `UnauthenticatedUserError` | `(message)` | 401 | Auth token missing or invalid |
| `ServerError` | `(message)` | 500 | Internal failure the user can't fix |
| `ApiError` | `(message, code, { errRes }?)` | Custom | Any scenario needing a custom code |

### Inheritance

Every class extends `ApiError`, so `err instanceof ApiError` matches all of them:

```text
Error
└── ApiError
    ├── ValidationError
    │   └── InvalidValueError
    ├── UnauthenticatedUserError
    └── ServerError
```

### Methods available on all classes

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `.getCode()` | `number` | The HTTP status code |
| `.getErrorResponse()` | `ErrorResponse \| undefined` | The structured error payload. Always `undefined` for `UnauthenticatedUserError` and `ServerError` |

### Properties available on all classes

| Property | Type | Description |
| -------- | ---- | ----------- |
| `.message` | `string` | The error message (from `Error`) |
| `.name` | `string` | The class name, such as `'ValidationError'`. It's set as a string, so it survives minification |
| `.stack` | `string \| undefined` | The stack trace (from `Error`) |
| `.errorCode` | `number` | The value returned by `.getCode()` |
| `.errorResponse` | `ErrorResponse \| undefined` | The value returned by `.getErrorResponse()` |

- `JSON.stringify(error)` includes only `name`, `errorCode` and `errorResponse`. `message` and `stack` are left out, so log them separately.
- The constructors don't accept a `cause` option, and passing one is ignored.

### `ApiResponseErrorsValue` methods

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `ApiResponseErrorsValue.getInstance()` | `ApiResponseErrorsValue` | Creates a new, empty instance. Same as `new ApiResponseErrorsValue()` |
| `.addError(key, message)` | `this` | Sets a field's error and keeps other fields. Calling it again for the same field replaces its message |
| `.setError(key, message)` | `this` | Clears the errors for **all** fields, then sets this one |
| `.hasErrors()` | `boolean` | Whether any errors have been added |
| `.getErrors()` | `ApiResponseErrors \| undefined` | The `{ field: [messages] }` map, or `undefined` if there are no errors |
| `.getErrorResponse()` | `ErrorResponse` | The same map as `{ errors }`, ready to pass as `errRes` |

### Other exports

| Export | Description |
| ------ | ----------- |
| `setErrorCodes(codes)` | Changes the default status codes. See [Customizing Error Codes](#-customizing-error-codes) |
| `errorCodes` | The current status codes |

### Types

```ts
import type { ApiResponseErrors, ErrorCodes, ErrorResponse } from '@qnx/errors'

// Field names mapped to their messages
type ApiResponseErrors = Record<string, string[]>

// The `errRes` option and the return value of getErrorResponse()
interface ErrorResponse {
  errors?: ApiResponseErrors
}

// The argument to setErrorCodes() is Partial<ErrorCodes>
interface ErrorCodes {
  VALIDATION_ERROR_CODE: number
  UNAUTHENTICATED_USER_ERROR_CODE: number
  SERVER_ERROR_CODE: number
}
```

---

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/errors`

| Tool | Description |
| ---- | ----------- |
| `get-error-class-docs` | Constructor signature, methods, examples, and when to use each error class |
| `build-api-error` | Instantiate an error class with real values — preview resolved code and errorResponse |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

### HTTP (Streamable HTTP)

```json
{
  "mcpServers": {
    "qnx-errors": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/errors"
    }
  }
}
```

### stdio (via npx)

```json
{
  "mcpServers": {
    "qnx-errors": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp", "errors"]
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
