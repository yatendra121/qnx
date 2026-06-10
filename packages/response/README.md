# @qnx/response

@qnx/response is a library designed to simplify handling HTTP responses within Express.js applications. It offers standardized formatting and transmission of responses, including built-in support for error management and validation.

> 🤖 MCP Server: `https://qnx-mcp-server.vercel.app/mcp/response`

## ❗ The Problem

Every async Express route ends up looking like this:

```ts
router.post('/users', async (req, res) => {
  try {
    const user = await User.create(req.body)
    res.status(201).json({ data: user, message: 'Created.' })
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' })
  }
})
```

Multiply that across 50 routes and you have 50 copies of the same try/catch, the same `res.json()` boilerplate, and inconsistent response shapes.

## ✅ The Solution

Wrap your handler with `asyncValidatorHandler`. Return your data — the library formats the response and catches any errors automatically.

```ts
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

router.post('/users', asyncValidatorHandler(async (req) => {
  const user = await User.create(req.body)
  return initializeApiResponse().setData(user).setMessage('Created.')
}))
```

- 🚫 **No try/catch** — errors are caught and formatted automatically
- 📤 **No `res.json()`** — just return your data
- 📦 **Consistent shape** — every route returns `{ data }` or `{ error, errors }`
- 🧠 **TypeScript-first** — fully typed, excellent IntelliSense

---

## 📑 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
  - [Return data](#return-data)
  - [Return with a message](#return-with-a-message)
  - [Throw a single field error](#throw-a-single-field-error)
  - [Throw multiple field errors](#throw-multiple-field-errors)
  - [Zod validation](#zod-validation)
- [Migrating Existing Routes](#-migrating-existing-routes)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Features

| Feature                 | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| 📦 Standard Format      | Unified response structure across APIs                           |
| ✅ Validation Support   | Works with Zod and express-validator to handle validation errors |
| 🚫 No Try-Catch Needed  | Automatically handles async errors                               |
| ⚠️ Custom Error Support | Create and throw validation errors easily                        |
| 🧠 TypeScript-First     | Fully typed API with excellent IntelliSense support              |
| ⚙️ Configurable         | Flexible enough to adjust error structures and codes             |

## 📦 Installation

```bash
# Using npm
npm install @qnx/response

# Using yarn
yarn add @qnx/response

# Using pnpm
pnpm install @qnx/response

# Using bun
bun install @qnx/response
```

### Peer Dependencies

@qnx/response requires @qnx/errors as a peer dependency:

```bash
npm install @qnx/errors
```

## 💡 Usage

All examples use `asyncValidatorHandler` as the outer wrapper. Everything you `return` is sent as the response body.

### Return data

Return any value and it is automatically wrapped as `{ data: ... }`:

```ts
import { asyncValidatorHandler } from '@qnx/response'

router.get('/users', asyncValidatorHandler(async (req) => {
  return await User.findAll()
}))
```

```json
{ "data": [...] }
```

### Return with a message

Use `initializeApiResponse()` to attach a message or set a custom status code:

```ts
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

router.post('/users', asyncValidatorHandler(async (req) => {
  const user = await User.create(req.body)
  return initializeApiResponse().setData(user).setMessage('User created successfully.')
}))
```

```json
{ "data": { "id": 1, "name": "Alice" }, "message": "User created successfully." }
```

### Throw a single field error

Use `InvalidValueError` to signal that a specific field is invalid. The handler catches it and sends a 400 response:

```ts
import { asyncValidatorHandler, InvalidValueError } from '@qnx/response'

router.get('/users/:id', asyncValidatorHandler(async (req) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new InvalidValueError('User not found.', { key: 'id' })
  return user
}))
```

```json
{ "error": "User not found.", "errors": { "id": ["User not found."] } }
```

### Throw multiple field errors

Use `ApiResponseErrorsValue` to collect multiple field errors, then throw `ValidationError`:

```ts
import { asyncValidatorHandler, ValidationError, ApiResponseErrorsValue, initializeApiResponse } from '@qnx/response'

router.post('/register', asyncValidatorHandler(async (req) => {
  const { email, password } = req.body

  const errors = ApiResponseErrorsValue.getInstance()
  if (!email) errors.addError('email', 'Email is required.')
  if (!password) errors.addError('password', 'Password is required.')
  if (errors.hasErrors()) throw new ValidationError('Validation failed', { errRes: { errors: errors.getErrors() } })

  const user = await User.create({ email, password })
  return initializeApiResponse().setData(user).setMessage('Registered.')
}))
```

```json
{
  "error": "Validation failed",
  "errors": {
    "email": ["Email is required."],
    "password": ["Password is required."]
  }
}
```

### Zod validation

Zod errors thrown inside `asyncValidatorHandler` are caught and automatically converted into the standard `{ error, errors }` shape:

```ts
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string({ required_error: 'Name is required.' }),
  email: z.string({ required_error: 'Email is required.' }).email('Invalid email.')
})

router.post('/users', asyncValidatorHandler(async (req) => {
  const body = CreateUserSchema.parse(req.body)
  const user = await User.create(body)
  return initializeApiResponse().setData(user).setMessage('User created successfully.')
}))
```

**Valid input** `{ "name": "Alice", "email": "alice@example.com" }`:

```json
{ "data": { "id": 1, "name": "Alice", "email": "alice@example.com" }, "message": "User created successfully." }
```

**Invalid input** `{ "email": "alice@example.com" }` — missing name:

```json
{ "error": "Name is required.", "errors": { "name": ["Name is required."] } }
```

---

## 🔄 Migrating Existing Routes

### Callback-style DB query

```ts
// Before
router.get('/users', (req, res) => {
  connection.query('SELECT * FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ data: rows })
  })
})

// After — use an async DB client or promisify the callback
router.get('/users', asyncValidatorHandler(async (req) => {
  return await db.query('SELECT * FROM users')
}))
```

### async/await with try/catch

```ts
// Before
router.post('/users', async (req, res) => {
  try {
    const user = await User.create(req.body)
    res.status(201).json({ data: user, message: 'Created.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// After — remove try/catch entirely; errors are caught automatically
router.post('/users', asyncValidatorHandler(async (req) => {
  const user = await User.create(req.body)
  return initializeApiResponse().setData(user).setMessage('Created.')
}))
```

### Promise chains (.then/.catch)

```ts
// Before
router.get('/users/:id', (req, res) => {
  User.findById(req.params.id)
    .then(user => {
      if (!user) return res.status(404).json({ error: 'Not found' })
      res.json({ data: user })
    })
    .catch(err => res.status(500).json({ error: err.message }))
})

// After
router.get('/users/:id', asyncValidatorHandler(async (req) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new InvalidValueError('User not found.', { key: 'id' })
  return user
}))
```

### next(err) error forwarding

```ts
// Before
router.put('/users/:id', async (req, res, next) => {
  try {
    const updated = await User.update(req.params.id, req.body)
    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// After — asyncValidatorHandler handles errors inline; next() is no longer needed
router.put('/users/:id', asyncValidatorHandler(async (req) => {
  const updated = await User.update(req.params.id, req.body)
  return initializeApiResponse().setData(updated).setMessage('Updated successfully.')
}))
```

---

## 📘 API Reference

### `asyncValidatorHandler(fn)`

Wraps an async route handler. Catches all thrown errors, formats responses, and removes the need for `res.json()` or try/catch.

```ts
asyncValidatorHandler(async (req, res) => {
  // return data  → sent as { data: ... }
  // throw error  → caught, formatted as { error, errors }
})
```

### `initializeApiResponse()`

Creates a chainable response builder. Return the result from inside `asyncValidatorHandler`.

#### ✅ Success & Data

| Method                  | Description                          | Example                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| `.setData(data)`        | Sets the response data               | `.setData({ user: { name: 'Alice' } })`        |
| `.setMessage(message)`  | Sets a success message               | `.setMessage('User fetched successfully.')`    |

#### ⚠️ Error Management

| Method                  | Description                          | Example                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| `.setError(message)`    | Sets a top-level error message       | `.setError('Internal Server Error')`           |
| `.setErrors(errors)`    | Sets field-level errors              | `.setErrors({ email: ['Invalid format'] })`    |
| `.setErrorCode(code)`   | Sets a custom error code string      | `.setErrorCode('E123')`                        |

#### 📦 Additional Meta

| Method                  | Description                          | Example                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| `.setStatusCode(code)`  | Sets the HTTP status code            | `.setStatusCode(201)`                          |
| `.setAdditional(data)`  | Attaches extra metadata to the body  | `.setAdditional({ traceId: 'xyz-001' })`       |

---

### `ApiResponseErrorsValue`

Builds field-level error objects in `{ field: [messages] }` format.

#### ✏️ Add / Set Errors

| Method                    | Description                                  | Example                                   |
| ------------------------- | -------------------------------------------- | ----------------------------------------- |
| `.getInstance()`          | Returns a new instance                       |                                           |
| `.addError(key, message)` | Appends a message to a field's error list    | `.addError('email', 'Invalid format')`    |
| `.setError(key, message)` | Replaces all messages for a field            | `.setError('email', 'Required')`          |
| `.hasErrors()`            | Returns `true` if any errors have been added |                                           |

#### 📤 Get Structured Errors

| Method                | Returns                              | Example               |
| --------------------- | ------------------------------------ | --------------------- |
| `.getErrors()`        | `{ field: [messages] }`              | `.getErrors()`        |
| `.getErrorResponse()` | `{ errors: { field: [messages] } }`  | `.getErrorResponse()` |

---

### Error Classes

Throw these inside `asyncValidatorHandler` — the handler catches them and sends the formatted response automatically.

| Class | Use case |
| ----- | -------- |
| `InvalidValueError(message, { key })` | Single field validation error |
| `ValidationError(message, { errRes: { errors } })` | Multiple field errors — pair with `ApiResponseErrorsValue` |

### Error Response Helpers

Call these directly only where throwing is not an option — e.g. plain Express middleware outside `asyncValidatorHandler`. Inside the handler, throw the error classes above instead.

#### `invalidValueApiResponse(res, key, message)` — deprecated

> **Deprecated:** throw `InvalidValueError` instead — it produces the identical response, needs no `res`, and halts execution:
>
> ```ts
> import { InvalidValueError } from '@qnx/errors'
>
> router.get('/users/:id', asyncValidatorHandler(async (req) => {
>   const user = await User.findById(req.params.id)
>   if (!user) throw new InvalidValueError('User not found.', { key: 'id' })
>   return user
> }))
> ```

```json
{ "error": "User not found.", "errors": { "id": ["User not found."] } }
```

#### `invalidApiResponse(res, errors)`

Sends a 400 response with multiple field errors:

```ts
import { asyncValidatorHandler, invalidApiResponse, ApiResponseErrorsValue } from '@qnx/response'

router.post('/register', asyncValidatorHandler(async (req, res) => {
  const { email, password } = req.body

  const errors = ApiResponseErrorsValue.getInstance()
  if (!email) errors.addError('email', 'Email is required.')
  if (!password) errors.addError('password', 'Password is required.')
  if (errors.hasErrors()) return invalidApiResponse(res, errors.getErrors())

  const user = await User.create({ email, password })
  return initializeApiResponse().setData(user).setMessage('Registered.')
}))
```

```json
{
  "error": "Validation failed",
  "errors": {
    "email": ["Email is required."],
    "password": ["Password is required."]
  }
}
```

> **Throw vs Return:** Inside `asyncValidatorHandler`, always throw `InvalidValueError` / `ValidationError` — it exits from any depth, needs no `res`, and TypeScript narrows types after the throw. Reserve `invalidApiResponse` for code that runs outside the handler (plain Express middleware), where a thrown error has no catcher.

---

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/response`

| Tool | Description |
| --- | --- |
| `get-response-docs` | Documentation for handler setup, success responses, validation errors, Zod, unauthenticated, and resource routes |
| `build-api-response` | Show HTTP status code, response body shape, and which @qnx/response function produces it |
| `transform-to-async-handler` | Before/after migration examples for callback, try/catch, promise chain, and next(err) patterns |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

### HTTP (Streamable HTTP)

Connect directly to the hosted server — no installation required:

```json
{
  "mcpServers": {
    "qnx-response": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/response"
    }
  }
}
```

### stdio (via npx)

Run the MCP server locally using `npx`. Use this if your client doesn't support HTTP transport or you prefer a local setup:

```json
{
  "mcpServers": {
    "qnx-response": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp", "response"]
    }
  }
}
```

The `response` argument scopes the server to only load `@qnx/response` tools. Omit it to load all qnx tools.

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
