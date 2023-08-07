# @qnx/response

@qnx/response is a library for handling HTTP responses in Express.js applications. It provides a standardized way of formatting and sending responses, with built-in support for error handling and validation.

### Core features:

**Standardized response formatting:** @qnx/response provides a consistent way of formatting responses, with a common structure for all responses that includes data, metadata, and errors.

**Validation:** @qnx/response integrates with popular validation libraries like Zod and express-validator, making it easy to handle validation errors in a consistent It automatically returns error responses if validation fails.

**No try-catch blocks:** @qnx/response handles errors and exceptions automatically, removing the need to write try-catch blocks in your code. This reduces the amount of boilerplate code and makes your code cleaner and easier to read.

**Error handling:** @qnx/response makes it easy to handle errors in a consistent way, with built-in support for common error types like 404 (Not Found) and 500 (Internal Server Error).

**Type Strong:** With the addition of full TypeScript typings support, the @qnx/response provides enhanced developer experience and the advantages of static typing.

**Customization:** @qnx/response is highly customizable, with options for configuring the response format, error handling, and more.

Overall, @qnx/response makes it easy to handle HTTP responses in a consistent and predictable way, reducing the amount of boilerplate code required for error handling and validation, and improving the overall maintainability of Express.js applications.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/response.

```bash
npm install @qnx/response
```

You can also use [yarn](https://yarnpkg.com/) & [pnpm](https://pnpm.io/)

```bash
yarn add @qnx/response
```

```bash
pnpm install @qnx/response
```

#### Peer-Dependencies

@qnx/response is using error instances of @qnx/errors.

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

To use @qnx/response, you first need to import it into your Node.js application:

```javascript
import { ApiResponse, asyncValidatorHandler } from '@qnx/response'
```

#### Creating an API response

To create an API response, you can use the ApiResponse class. You can create a new instance of the class and set the response properties using the various methods available:

```javascript
express.get(
  '/',
  asyncValidatorHandler(async (req, res) => {
    const response = new ApiResponse()

    return response
      .setData({ user: { name: 'Foo' } })
      .setMessage('Success')
      .response(res)
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

The above code creates a new ApiResponse instance, sets the data property to an object with a message property, sets the message property to 'Success', and sends the response using the response method.

### Handling errors

@qnx/response also provides a way to handle errors in your API responses. You can define a single error response using the **invalidValueApiResponse** function.

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

You can use the **ApiResponseErrors** interface to define an object that contains the errors.

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

#### Alternatives ways to Handling errors

You can use @qnx/error with @qnx/response to throw the exceptions and pass data to the end user.

You can define error response using the **ValidationError** class.

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

You can define error response using the **InvalidValueError** class for a single error response.

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

The below code shows an example of how @qnx/response is handling Zod errors in an API response. In this example, we define a UserRequest and use Zod to validate the request body. If the request is invalid, the Zod will throw an error with the validation errors, which will be caught by asyncValidatorHandler.

```javascript
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'
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

    return initializeApiResponse().setData(user).setMessage('User created successfully.')
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

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
