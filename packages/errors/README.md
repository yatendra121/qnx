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
  - [UnauthenticatedUserError](#unauthenticatedusererror)
  - [ServerError](#servererror)
  - [ApiError](#apierror)
- [Customizing Error Codes](#-customizing-error-codes)
- [Error Class Reference](#-error-class-reference)
- [MCP Server](#-mcp-server)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

| Feature | Description |
| ------- | ----------- |
| 🎯 **Typed errors** | Each scenario has its own class — no guessing what went wrong |
| 📦 **Consistent shape** | Every error produces the same `{ error, errors }` response structure |
| ⚙️ **Configurable codes** | Default HTTP status codes work out of the box, override them if needed |
| 🔗 **Built for `@qnx/response`** | Errors thrown inside `asyncValidatorHandler` are caught and formatted automatically |

## 📦 Installation

```bash
npm install @qnx/errors

# yarn
yarn add @qnx/errors

# pnpm
pnpm add @qnx/errors
```

---

## 💡 Usage

All examples below show errors thrown inside `asyncValidatorHandler` from `@qnx/response`. The handler catches them and sends the formatted HTTP response automatically.

### `InvalidValueError`

Use when a single field fails validation. Pass the field name as `key` and a message.

```ts
import { asyncValidatorHandler } from '@qnx/response'
import { InvalidValueError } from '@qnx/errors'

router.get('/users/:id', asyncValidatorHandler(async (req) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new InvalidValueError('User not found.', { key: 'id' })
  return user
}))
```

**HTTP 400 response:**

```json
{
  "error": "User not found.",
  "errors": {
    "id": ["User not found."]
  }
}
```

---

### `ValidationError`

Use when multiple fields fail validation. Build the `errors` object manually and pass it in.

```ts
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'
import { ValidationError } from '@qnx/errors'

router.post('/register', asyncValidatorHandler(async (req) => {
  const { email, password } = req.body
  const errors: Record<string, string[]> = {}

  if (!email) errors.email = ['Email is required.']
  if (!password) errors.password = ['Password must be at least 8 characters.']

  if (Object.keys(errors).length) {
    throw new ValidationError('Validation failed', { errRes: { errors } })
  }

  const user = await User.create({ email, password })
  return initializeApiResponse().setData(user).setMessage('Registered.')
}))
```

**HTTP 400 response:**

```json
{
  "error": "Validation failed",
  "errors": {
    "email": ["Email is required."],
    "password": ["Password must be at least 8 characters."]
  }
}
```

---

### `UnauthenticatedUserError`

Use when a request is missing authentication or the token is invalid.

```ts
import { asyncValidatorHandler } from '@qnx/response'
import { UnauthenticatedUserError } from '@qnx/errors'

router.get('/profile', asyncValidatorHandler(async (req) => {
  if (!req.headers.authorization) {
    throw new UnauthenticatedUserError('Authentication required.')
  }
  return await User.findById(req.user.id)
}))
```

**HTTP 401 response:**

```json
{
  "error": "Authentication required."
}
```

---

### `ServerError`

Use for unexpected failures that the user cannot fix — database down, third-party API unreachable, etc.

```ts
import { asyncValidatorHandler } from '@qnx/response'
import { ServerError } from '@qnx/errors'

router.get('/reports', asyncValidatorHandler(async (req) => {
  const result = await ReportService.generate().catch(() => {
    throw new ServerError('Report generation failed. Please try again later.')
  })
  return result
}))
```

**HTTP 500 response:**

```json
{
  "error": "Report generation failed. Please try again later."
}
```

---

### `ApiError`

The base class — use it when none of the above fit and you need a custom HTTP status code.

```ts
import { asyncValidatorHandler } from '@qnx/response'
import { ApiError } from '@qnx/errors'

router.post('/payment', asyncValidatorHandler(async (req) => {
  const result = await PaymentService.charge(req.body)
  if (result.status === 'declined') {
    throw new ApiError('Payment declined.', 402, {
      errRes: { errors: { card: ['Insufficient funds.'] } }
    })
  }
  return result
}))
```

**HTTP 402 response:**

```json
{
  "error": "Payment declined.",
  "errors": {
    "card": ["Insufficient funds."]
  }
}
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

This affects all `ValidationError`, `InvalidValueError`, and `UnauthenticatedUserError` instances globally.

---

## 📘 Error Class Reference

| Class | Constructor | HTTP Code | Use When |
| ----- | ----------- | --------- | -------- |
| `InvalidValueError` | `(message, { key })` | 400 | A single field is invalid |
| `ValidationError` | `(message, { errRes: { errors } })` | 400 | Multiple fields fail validation |
| `UnauthenticatedUserError` | `(message)` | 401 | Auth token missing or invalid |
| `ServerError` | `(message)` | 500 | Internal failure the user can't fix |
| `ApiError` | `(message, code, { errRes? })` | Custom | Any scenario needing a custom code |

### Methods available on all classes

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `.getCode()` | `number` | The HTTP status code |
| `.getErrorResponse()` | `ErrorResponse \| undefined` | The structured error payload |
| `.message` | `string` | The error message (from `Error`) |

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
