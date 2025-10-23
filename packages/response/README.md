# @qnx/response

@qnx/response is a library designed to simplify handling HTTP responses within Express.js applications. It offers standardized formatting and transmission of responses, including built-in support for error management and validation.

## 📑 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#usage)
  - [Basic Example](#basic-example)
  - [Response Structure](#response-structure)
  - [Handling errors](#handling-errors)
  - [Alternative Error Handling Methods](#alternative-error-handling-methods)
  - [Zod Built-in](#zod-built-in)
- [API Reference](#-api-reference)
  - [Getting the Instance](#getting-the-instance)
  - [ApiResponse – Building Your Response](#apiresponse--building-your-response)
  - [ApiResponseErrorsValue – Building Field-Level Errors](#apiresponseerrorsvalue--building-field-level-errors)
  - [Example: Full Error Response](#example-full-error-response)
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

Install @qnx/response via [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/):

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/response.

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

#### Peer-Dependencies

@qnx/response requires @qnx/errors as a peer dependency:

```bash
npm install @qnx/errors
```

## 💡Usage

#### Basic Example

```ts
import { asyncValidatorHandler } from '@qnx/response'

app.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    return await UserModel.findAll()
  })
)
```

### Without `@qnx/response`

```ts
app.get('/', async (req, res) => {
  try {
    const users = await UserModel.findAll()
    res.send({ data: users })
  } catch (err) {
    res.status(500).send({ error: 'Internal Server Error' })
  }
})
```

### Response Structure

To utilize @qnx/response, import it into your Node.js application:

```javascript
import { ApiResponse, asyncValidatorHandler } from '@qnx/response'
```

#### Creating an API response

Create an API response using the ApiResponse class. Set response properties using available methods:

```javascript
express.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    return new ApiResponse().setData({ user: { name: 'Foo' } }).setMessage('Success')
  })
)

/*
{
  data: {
    user: { name: 'Foo' }
  },
  message: 'Success'
}
*/
```

The above code creates a new ApiResponse instance, sets data to an object with a message property, and sends the response.

### Handling errors

@qnx/response provides error handling mechanisms for API responses. Define error responses using the invalidValueApiResponse function.

```javascript
express.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    const errorKey = 'foo'
    const errorMessage = 'Foo is required.'
    return invalidValueApiResponse(res, errorKey, errorMessage)
  })
)

/*
{
  errors: {
    foo: ['Foo is required.']
  },
  error: 'Foo is required.'
}
*/
```

Use the **ApiResponseErrors** interface to define an object containing errors.

```javascript
import { asyncValidatorHandler, invalidApiResponse, ApiResponseErrorsValue } from '@qnx/response'

express.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    const errors = ApiResponseErrorsValue.getInstance()
      .addError('foo', 'Foo is required.')
      .addError('bar', 'Bar is required.')
      .getErrors()

    return invalidApiResponse(res, errors)
  })
)

/*
{
  errors: {
    foo: ['Foo is required.'],
    bar: ['Bar is required.']
  },
  error: 'Foo is required.'
}
*/
```

#### Alternative Error Handling Methods

Utilize @qnx/error with @qnx/response to throw exceptions and pass data to end-users.

Define error responses using the **ValidationError** class:

```javascript
import { asyncValidatorHandler, ValidationError, ApiResponseErrorsValue } from '@qnx/response'

express.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    const errors = ApiResponseErrorsValue.getInstance()
      .addError('foo', 'Foo is required.')
      .addError('bar', 'Bar is required.')
      .getErrors()

    throw new ValidationError('Errors', { errRes: { errors } })
  })
)

/*
{
  errors: {
    foo: ['Foo is required.'],
    bar: ['Bar is required.']
  },
  error: 'Foo is required.'
}
*/
```

Define error responses using the InvalidValueError class for single error responses:

```javascript
import { asyncValidatorHandler, InvalidValueError } from '@qnx/response'

express.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    throw new InvalidValueError('Foo is required.', { key: 'foo' })
  })
)

/*
{
  errors: {
    foo: ['Foo is required.']
  },
  error: 'Foo is required.'
}
*/
```

#### Zod Built-in

Example demonstrating @qnx/response handling Zod errors in an API response:

```javascript
import { asyncValidatorHandler, ApiResponse } from '@qnx/response'
import { z } from 'zod'

express.post(
  '/create-user',
  asyncValidatorHandler(async (req, res) => {
    export const UserSchema = z.object({
      name: z.string(),
      email: z.string()
    })

    const userData = UserSchema.parse(this.req.body)

    const user = UserModel.create(userData)

    return ApiResponse.getInstance().setData(user).setMessage('User created successfully.')
  })
)

/*
=> { name: 'foo', email:'foo@abc.com' }
{
  data: {
    user: { name: 'foo', email: 'foo@abc.com' }
  },
  message: 'User created successfully.'
}

=> { email:'foo@abc.com' }
{
  errors: {
    name: ['Name is required.'],
  },
  error: 'Name is required.'
}
*/
```

## 📘 API Reference

This guide helps you understand how to build structured API responses using `ApiResponse` and manage field-level errors using `ApiResponseErrorsValue`.

### Getting the Instance

```ts
ApiResponse.getInstance()
```

Returns a new instance of the response object that you can build on.

### ApiResponse – Building Your Response

#### ✅ Success & Data

| Method                | Description                              | Example                                    |
| --------------------- | ---------------------------------------- | ------------------------------------------ |
| `setData(data)`       | Sets the main data for success responses | `.setData({ user: { name: 'John' } })`     |
| `setMessage(message)` | Sets a human-readable message            | `.setMessage('User fetched successfully')` |

#### ⚠️ Error Management

| Method               | Description                      | Example                                     |
| -------------------- | -------------------------------- | ------------------------------------------- |
| `setError(error)`    | Sets a general error message     | `.setError('Internal Server Error')`        |
| `setErrorCode(code)` | Sets a custom error code string  | `.setErrorCode('E123')`                     |
| `setErrors(errors)`  | Sets detailed field-level errors | `.setErrors({ email: ['Invalid format'] })` |

#### 📦 Additional Meta

| Method                  | Description                | Example                                  |
| ----------------------- | -------------------------- | ---------------------------------------- |
| `setStatusCode(status)` | Sets HTTP status code      | `.setStatusCode(400)`                    |
| `setAdditional(data)`   | Adds any extra custom data | `.setAdditional({ traceId: 'xyz-001' })` |

### ApiResponseErrorsValue – Building Field-Level Errors

Use this when you want to build `errors` in `{ field: [message1, message2] }` format.

#### ✏️ Add / Set Errors

| Method               | Description                            | Example                                |
| -------------------- | -------------------------------------- | -------------------------------------- |
| `addError(key, msg)` | Appends an error message to a field    | `.addError('email', 'Invalid format')` |
| `setError(key, msg)` | Replaces existing error(s) for a field | `.setError('email', 'Required field')` |

#### Get Structured Errors

| Method               | Returns                        | Example               |
| -------------------- | ------------------------------ | --------------------- |
| `getErrors()`        | `{ field: [messages] }`        | `.getErrors()`        |
| `getErrorResponse()` | `{ errors: { field: [...] } }` | `.getErrorResponse()` |

### Example: Full Error Response

```ts
const errors = ApiResponseErrorsValue.getInstance()
  .addError('email', 'Invalid format')
  .addError('password', 'Must be at least 8 characters')
  .getErrors()

const response = ApiResponse.getInstance()
  .setErrors(errors)
  .setStatusCode(400)
  .setError('Validation failed')

console.log(response)
```

📤 **Output:**

```json
{
  "error": "Validation failed",
  "errors": {
    "email": ["Invalid format"],
    "password": ["Must be at least 8 characters"]
  },
  "statusCode": 400
}
```

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
