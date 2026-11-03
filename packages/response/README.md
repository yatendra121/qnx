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
  - [What the handler does with your return value](#what-the-handler-does-with-your-return-value)
  - [How thrown errors become responses](#how-thrown-errors-become-responses)
  - [CRUD routes with resourceRoute](#crud-routes-with-resourceroute)
  - [Log unexpected errors](#log-unexpected-errors)
  - [Change the default status codes](#change-the-default-status-codes)
  - [Typed requests](#typed-requests)
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

@qnx/response needs these packages alongside it:

| Package       | Version  |
| ------------- | -------- |
| `@qnx/errors` | `>=0.8.0` |
| `express`     | `4.x` or `5.x` |
| `zod`         | `4.x`    |

```bash
npm install @qnx/errors express zod
```

## 💡 Usage

All examples use `asyncValidatorHandler` as the outer wrapper. What you `return` becomes the response body, with [a few exceptions](#what-the-handler-does-with-your-return-value).

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
import { asyncValidatorHandler } from '@qnx/response'
import { InvalidValueError } from '@qnx/errors'

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
import { asyncValidatorHandler, ApiResponseErrorsValue, initializeApiResponse } from '@qnx/response'
import { ValidationError } from '@qnx/errors'

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
  "error": "Email is required.",
  "errors": {
    "email": ["Email is required."],
    "password": ["Password is required."]
  }
}
```

The top-level `error` is always the first message of the first field. The message passed to `ValidationError` is not sent to the client.

### Zod validation

Zod errors thrown inside `asyncValidatorHandler` are caught and automatically converted into the standard `{ error, errors }` shape:

```ts
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string({ error: 'Name is required.' }),
  email: z.email({ error: 'Invalid email.' })
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

Nested fields use dot-separated keys, such as `address.city` or `tags.0`. Errors are recognised by their shape rather than `instanceof`, so an error from a second copy of zod is still treated as a validation error.

### What the handler does with your return value

| You return | What happens |
| ---------- | ------------ |
| An `ApiResponse` (from `initializeApiResponse()`) | It is sent with its own status code and fields |
| Any other value, including `null`, `0` and `''` | `200 { "data": value }` |
| `res` (for example `return res.status(202).send(...)`) | Nothing more is sent |
| `undefined`, or nothing at all | `next()` is called and the next matching route or middleware runs |

If nothing else matches, a handler that forgets to return falls through to a 404. You can also use this on purpose to write middleware:

```ts
router.use(asyncValidatorHandler(async (req, res) => {
  res.locals.user = await getUser(req)
  // returns undefined, so the next handler runs
}))
```

If a response has already been sent, later responses are ignored, so `ERR_HTTP_HEADERS_SENT` isn't raised. The first response wins.

### How thrown errors become responses

| Thrown inside the handler | Status | Body |
| ------------------------- | ------ | ---- |
| `ValidationError`, `InvalidValueError` | 400 | `{ error, errors }` |
| `ZodError` | 400 | `{ error, errors }` |
| `UnauthenticatedUserError` | 401 | `{ errorCode: "unauthenticated", message: "Unauthenticated" }` |
| `ApiError` | The code you pass | `{ message }`, or `{ message, error, errors }` if `errRes` has errors |
| `ServerError` | 500 | `{ message }` |
| Anything else | 500 | `{ serverError: { name, message, stack } }` |

- The message passed to `UnauthenticatedUserError` is not sent. The response always says `Unauthenticated`.
- A `ValidationError` needs at least one field. With `errRes: {}` the body is `{}`, and with `errors: {}` it's `{ "errors": {} }`, so the client gets no message.
- Your own classes that extend `ApiError` are handled the same way as `ApiError`.
- Only the last row calls the [`setCallback`](#log-unexpected-errors) logger, so log the original error yourself before replacing it with a `ServerError`.

> ⚠️ **Unexpected errors reach the client.** The last row includes the error's message and stack trace in the response, in every environment, and it can't be turned off. Throw `ServerError` or `ApiError` when the message is safe to show, and catch errors that could contain sensitive details, such as database connection strings.

### CRUD routes with resourceRoute

`resourceRoute` registers a route for each function you provide, wrapping each one in `asyncValidatorHandler`. All of the functions are optional.

```ts
import express from 'express'
import { resourceRoute, initializeApiResponse } from '@qnx/response'

const router = express.Router()

resourceRoute(router, {
  findAll: async () => User.findAll(),
  findOne: async (req) => User.findById(req.params.id),
  create: async (req) => {
    const user = await User.create(req.body)
    return initializeApiResponse().setData(user).setStatusCode(201)
  },
  update: async (req) => User.update(req.params.id, req.body),
  remove: async (req) => User.delete(req.params.id),
  changeStatus: async (req) => User.toggleStatus(req.params.id)
})

app.use('/users', router)
```

| Function       | Method   | Path                 |
| -------------- | -------- | -------------------- |
| `findAll`      | `GET`    | `/`                  |
| `findOne`      | `GET`    | `/:id`               |
| `create`       | `POST`   | `/`                  |
| `update`       | `PUT`    | `/:id`               |
| `remove`       | `DELETE` | `/:id`               |
| `changeStatus` | `PUT`    | `/change-status/:id` |

The methods and paths are fixed. Add other routes to the same router in the usual way.

### Log unexpected errors

Use `setCallback` once at startup to pass unexpected errors to your logger:

```ts
import { setCallback } from '@qnx/response'
import { logger } from '@qnx/winston'

setCallback({
  logger: {
    serverError: (error) => logger.error('API Handler:', error)
  }
})
```

- It's called only for the "anything else" row in [the table above](#how-thrown-errors-become-responses), not for validation, authentication, `ApiError` or `ServerError` errors.
- It runs just after the response is sent, without being awaited.
- Anything can be thrown in JavaScript, so `error` isn't always an `Error` at runtime.
- Calling `serverErrorApiResponse` yourself doesn't call the logger.

### Change the default status codes

Use `setErrorCodes` from `@qnx/errors` once at startup, for example to send validation errors as 422:

```ts
import { setErrorCodes } from '@qnx/errors'

setErrorCodes({ VALIDATION_ERROR_CODE: 422 })
```

| Key                               | Default |
| --------------------------------- | ------- |
| `VALIDATION_ERROR_CODE`           | 400     |
| `UNAUTHENTICATED_USER_ERROR_CODE` | 401     |
| `SERVER_ERROR_CODE`               | 500     |

Errors created before the call keep their old status code, except `UnauthenticatedUserError`, whose response always uses the current code.

### Typed requests

Pass your own request type to type `req`. It must extend Express's `Request`:

```ts
import type { Request } from 'express'

interface AuthRequest extends Request {
  user: { id: number }
}

router.get('/me', asyncValidatorHandler<AuthRequest>(async (req) => {
  return await User.findById(req.user.id)
}))
```

`resourceRoute<AuthRequest>(router, controller)` works the same way.

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

The function also receives `next` as its third argument. See [what the handler does with your return value](#what-the-handler-does-with-your-return-value) and [how thrown errors become responses](#how-thrown-errors-become-responses).

### `resourceRoute(router, controller)`

Registers CRUD routes on an Express router from an object of optional functions. See [CRUD routes with resourceRoute](#crud-routes-with-resourceroute).

### `setCallback({ logger })`

Sets the logger for unexpected errors. See [Log unexpected errors](#log-unexpected-errors). The current value is available as `callbackObj`.

### `initializeApiResponse()`

Creates a chainable response builder. Return the result from inside `asyncValidatorHandler`. It's a shorthand for `ApiResponse.getInstance()` or `new ApiResponse()`.

The response body can contain any of these fields. Fields you don't set are left out.

| Field         | Set by             |
| ------------- | ------------------ |
| `data`        | `.setData()`       |
| `message`     | `.setMessage()`    |
| `error`       | `.setError()`, or the first message in `errors` |
| `errors`      | `.setErrors()`     |
| `errorCode`   | `.setErrorCode()`  |
| `serverError` | `.setServerError()` |

#### ✅ Success & Data

| Method                  | Description                          | Example                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| `.setData(data)`        | Sets the response data               | `.setData({ user: { name: 'Alice' } })`        |
| `.setMessage(message)`  | Sets a success message               | `.setMessage('User fetched successfully.')`    |

#### ⚠️ Error Management

| Method                  | Description                          | Example                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| `.setError(message)`    | Sets a top-level error message. If `errors` is also set, the first field's first message replaces it | `.setError('Internal Server Error')`           |
| `.setErrors(errors)`    | Sets field-level errors              | `.setErrors({ email: ['Invalid format'] })`    |
| `.setErrorCode(code)`   | Sets a custom error code string      | `.setErrorCode('E123')`                        |
| `.setServerError(err)`  | Sets `serverError` to the error's `name`, `message` and `stack`. These reach the client, so don't use it with sensitive errors | `.setServerError(err)`                         |

#### 📦 Additional Meta

| Method                  | Description                          | Example                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| `.setStatusCode(code)`  | Sets the HTTP status code. Defaults to 200 | `.setStatusCode(201)`                          |
| `.setAdditional(data)`  | Attaches extra top-level fields to the body. Calling it again replaces the earlier fields, and fields set by the other methods win if a name is used twice | `.setAdditional({ traceId: 'xyz-001' })`       |
| `.response(res)`        | Sends the response. You don't need it when returning from `asyncValidatorHandler`. Does nothing if a response was already sent | `.response(res)`                               |

---

### `ApiResponseErrorsValue`

Builds field-level error objects in `{ field: [messages] }` format.

#### ✏️ Add / Set Errors

| Method                    | Description                                  | Example                                   |
| ------------------------- | -------------------------------------------- | ----------------------------------------- |
| `.getInstance()`          | Returns a new instance                       |                                           |
| `.addError(key, message)` | Sets a field's error and keeps other fields. Calling it again for the same field replaces its message | `.addError('email', 'Invalid format')`    |
| `.setError(key, message)` | Clears the errors for **all** fields, then sets this one | `.setError('email', 'Required')`          |
| `.hasErrors()`            | Returns `true` if any errors have been added |                                           |

#### 📤 Get Structured Errors

| Method                | Returns                              | Example               |
| --------------------- | ------------------------------------ | --------------------- |
| `.getErrors()`        | `{ field: [messages] }`, or `undefined` if there are no errors | `.getErrors()`        |
| `.getErrorResponse()` | `{ errors: { field: [messages] } }`  | `.getErrorResponse()` |

---

### Error Classes

Throw these inside `asyncValidatorHandler` — the handler catches them and sends the formatted response automatically.

| Class | Use case |
| ----- | -------- |
| `InvalidValueError(message, { key })` | Single field validation error |
| `ValidationError(message, { errRes: { errors } })` | Multiple field errors — pair with `ApiResponseErrorsValue` |
| `ApiError(message, statusCode, { errRes }?)` | Any other HTTP status — e.g. `throw new ApiError('Conflict detected.', 409)` responds `409 { message }` |
| `UnauthenticatedUserError(message)` | The user isn't signed in — responds `401`. The message isn't sent to the client |
| `ServerError(message)` | A 500 with a message that's safe to show — responds `500 { message }`, with no stack trace |

All of these are imported from `@qnx/errors`. See [how thrown errors become responses](#how-thrown-errors-become-responses) for the exact bodies.

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
  "error": "Email is required.",
  "errors": {
    "email": ["Email is required."],
    "password": ["Password is required."]
  }
}
```

The optional third argument sets the status code, for example `invalidApiResponse(res, errors, 422)`. It defaults to `VALIDATION_ERROR_CODE`. If `errors` is `undefined`, the body is `{}`.

> **Throw vs Return:** Inside `asyncValidatorHandler`, always throw `InvalidValueError` / `ValidationError` — it exits from any depth, needs no `res`, and TypeScript narrows types after the throw. Reserve `invalidApiResponse` for code that runs outside the handler (plain Express middleware), where a thrown error has no catcher.

#### `errorApiResponse(res, error)`

Sends the same response the handler would send for `error`, following [the same rules](#how-thrown-errors-become-responses). Use it in a `catch` block or an Express error handler outside `asyncValidatorHandler`:

```ts
import { errorApiResponse } from '@qnx/response'

app.use((err, req, res, next) => {
  errorApiResponse(res, err)
})
```

#### `unauthenticateApiResponse(res)`

Sends `401 { "errorCode": "unauthenticated", "message": "Unauthenticated" }`. Useful in auth middleware:

```ts
import { unauthenticateApiResponse } from '@qnx/response'

const requireAuth = (req, res, next) => {
  if (!req.headers.authorization) return unauthenticateApiResponse(res)
  next()
}
```

#### `serverErrorApiResponse(res, error)`

Sends `500 { "serverError": { "name", "message", "stack" } }`. The stack trace reaches the client and the `setCallback` logger isn't called.

#### `throwInvalidValueApiResponse(key, message)` — deprecated

> **Deprecated:** use `throw new InvalidValueError(message, { key })` instead.

Throws a `ValidationError` for one field. The handler turns it into the same 400 response.

#### `errorFormatter({ msg })`

Returns `[msg]`, so each field's errors are an array. It's meant for express-validator's `formatWith`, to match the `{ field: [messages] }` format:

```ts
import { validationResult } from 'express-validator'
import { errorFormatter, invalidApiResponse } from '@qnx/response'

const result = validationResult(req).formatWith(errorFormatter)
if (!result.isEmpty()) return invalidApiResponse(res, result.mapped())
```

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
