# `@qnx/errors`

`@qnx/errors` provides a set of custom error classes to help you simplify and standardize error handling in your JavaScript/TypeScript applications.

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/errors`

| Tool | Description |
| --- | --- |
| `get-error-class-docs` | Documentation for each error class — constructor signature, methods, examples, and when to use it |
| `build-api-error` | Instantiate an error class with real values — preview resolved code and errorResponse |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

**Configuration:**
```json
{
  "mcpServers": {
    "qnx-errors": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/errors"
    }
  }
}
```

## ✨ Features

- Predefined error classes for common scenarios
- Consistent structure for error responses
- Easy integration with APIs and validation logic

## 📦 Installation

You can install via your preferred package manager:

```bash
# npm
npm install @qnx/errors

# yarn
yarn add @qnx/errors

# pnpm
pnpm install @qnx/errors
```

## 🚀 Usage

### Importing Errors

```javascript
import {
  ApiError,
  ValidationError,
  InvalidValueError,
  UnauthenticatedUserError,
  ServerError
} from '@qnx/errors'
```

## 📘 Error Class Examples

### `ApiError`

```ts
const apiError = new ApiError('Something went wrong', 500, {
  errRes: {
    message: 'Server failed to respond',
    errors: {
      generic: ['Unexpected error occurred']
    }
  }
})

console.log(apiError.message) // "Something went wrong"
console.log(apiError.getCode()) // 500
console.log(apiError.getErrorResponse()) // { message: "...", errors: ... }
```

### `ValidationError`

```ts
const validationError = new ValidationError('Validation failed', {
  errRes: {
    message: 'Validation errors found',
    errors: {
      email: ['Email is invalid'],
      password: ['Password must be at least 8 characters']
    }
  }
})

console.log(validationError.getCode()) // errorCodes.VALIDATION_ERROR_CODE
console.log(validationError.getErrorResponse()) // Detailed error response
```

### `InvalidValueError`

```ts
const error = new InvalidValueError('Username cannot contain spaces', {
  key: 'username'
})

console.log(error.getCode()) // errorCodes.VALIDATION_ERROR_CODE
console.log(error.getErrorResponse()) // { errors: { username: ['Username cannot contain spaces'] } }
```

### `UnauthenticatedUserError`

```ts
const authError = new UnauthenticatedUserError('User not authenticated')

console.log(authError.getCode()) // errorCodes.UNAUTHENTICATED_USER_ERROR_CODE
console.log(authError.message) // "User not authenticated"
```

### `ServerError`

```ts
const serverError = new ServerError('Internal server error')

console.log(serverError.getCode()) // errorCodes.SERVER_ERROR_CODE
console.log(serverError.message) // "Internal server error"
```

## 📊 Summary Table

| Error Class                | Purpose                     | Default Code | Use When...                                 |
| -------------------------- | --------------------------- | ------------ | ------------------------------------------- |
| `ApiError`                 | Generic base error          | Custom       | You need a customizable error               |
| `ValidationError`          | Multi-field form validation | 422          | Input or schema validation fails            |
| `InvalidValueError`        | Single field validation     | 422          | One field like "email" or "username` is bad |
| `UnauthenticatedUserError` | Auth failure                | 401          | User not logged in or token missing         |
| `ServerError`              | Internal system failure     | 500          | Something broke that user can’t fix         |

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
