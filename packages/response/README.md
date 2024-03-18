# @qnx/response

@qnx/response is a library designed to simplify handling HTTP responses within Express.js applications. It offers standardized formatting and transmission of responses, including built-in support for error management and validation.

### Core features:

**Standardized response formatting:** @qnx/response provides a consistent way of formatting responses, with a common structure for all responses that includes data, metadata, and errors.

**Validation Support:** @qnx/response integrates with popular validation libraries like Zod and express-validator, making it easy to handle validation errors in a consistent It automatically returns error responses if validation fails.

**No try-catch blocks:** @qnx/response eliminates the need for manual try-catch blocks by automatically handling errors and exceptions. This reduces boilerplate code, enhancing code readability and cleanliness.

**Error handling:** @qnx/response makes it easy to handle errors in a consistent way, with built-in support for common error types like 400 (Bad Request) and 500 (Internal Server Error).

**Type Strong:** @qnx/response offers full TypeScript typings support, enhancing developer experience and leveraging the benefits of static typing.

**Customization:** @qnx/response is highly customizable with options for configuring response formats, error handling, and more.

In summary, @qnx/response streamlines HTTP response handling in Express.js applications, minimizing boilerplate code for error handling and validation while enhancing overall maintainability.

## Installation

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
npm install @qnx/response
```

#### Peer-Dependencies

@qnx/response requires @qnx/errors as a peer dependency:

```bash
npm install @qnx/errors
```

## Usage

#### Basic Example

```javascript
import { asyncValidatorHandler } from '@qnx/response'

express.get(
  '/',
  asyncValidatorHandler(async (req, res, next) => {
    return await Model.findAll()
  })
)
```

Without @qnx/response

```javascript
express.get('/', async (req, res, next) => {
  try {
    const data = await Model.findAll()
    res.send({ data })
  } catch (error) {
    // handle error response
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

### ApiResponse Methods

#### Static Method

**getInstance():**
Retrieves a new instance of ApiResponse.

```javascript
ApiResponse.getInstance()
```

#### Helper Methods

**setData(data: any):**
Sets the response data to the specified value.

```javascript
ApiResponse.getInstance().setData({ user: { name: 'John' } })
```

**setErrorCode(errorCode: string):**
Sets a specific error code for the response.

```javascript
ApiResponse.getInstance().setErrorCode('E123')
```

**setError(error: string):**
Sets a general error message for the response.

```javascript
ApiResponse.getInstance().setError('Internal Server Error')
```

**setErrors(errors: ApiResponseErrors):**
Sets multiple errors for the response using an ApiResponseErrors object.

```javascript
const customErrors = { field1: ['Error 1'], field2: ['Error 2'] }
ApiResponse.getInstance().setErrors(customErrors)
```

**setMessage(message: string):**
Sets a custom message for the response.

```javascript
ApiResponse.getInstance().setMessage('Operation successful')
```

**setStatusCode(statusCode: number):**
Sets the HTTP status code for the response.

```javascript
ApiResponse.getInstance().setStatusCode(200)
```

**setAdditional(data: { [key: string]: unknown }):**
Sets additional custom data for the response.

```javascript
ApiResponse.getInstance().setAdditional({ key1: 'value1', key2: 'value2' })
```

### ApiResponseErrorsValue Methods

**setError(errorKey: string, errorMessage: string):**
Set a single error message for a specific type of error.

```javascript
ApiResponseErrorsValue.getInstance().setError('email', 'Invalid email format')
```

**addError(errorKey: string, errorMessage: string):**
Add a new error message to the existing errors collection.

```javascript
ApiResponseErrorsValue.getInstance().addError('password', 'Password must be at least 8 characters')
```

**getErrorResponse():**
Retrieve all collected errors as a response object.

```javascript
const errorResponse = ApiResponseErrorsValue.getInstance().addError('foo', 'bar').getErrorResponse()
console.log(errorResponse)

/*
{
  errors: {
    foo: ['bar'],
  },
}
*/
```

**getErrors():**
Returns the collection of errors stored within the `ApiResponseErrorsValue` instance.

```javascript
const errors = ApiResponseErrorsValue.getInstance().addError('foo', 'bar').getErrors()
console.log(errors)

/*
{
  foo: ['bar'],
}
*/
```

These methods offer flexibility in tailoring responses to specific requirements. Utilize them in combination to construct responses that align with your application's needs.

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
