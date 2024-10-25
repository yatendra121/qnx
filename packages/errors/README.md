# @qnx/errors

`@qnx/errors` provides a collection of error classes to simplify error handling in your code. These classes allow you to create custom error instances for different situations such as validation errors, authentication errors, and server-side errors.

## Installation

Install @qnx/errors via [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/):

```bash
npm install @qnx/errors
```

Alternatively, you can use [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/):

```bash
yarn add @qnx/errors
```

```bash
pnpm install @qnx/errors
```

```bash
bun install @qnx/errors
```

## Usage

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

### Error Class Breakdown

Each of these classes can be used to represent a specific kind of error. Below is an explanation of how to use each class and what they do:

### `ApiError`

- **Description**: The base class for all API-related errors. Other error classes inherit from this class.
- **Methods**:
  - `getCode()`: Returns the HTTP status code associated with the error.
  - `getErrorResponse()`: Returns the error response object, which can be customized based on the API response structure.
- **Example**:
  ```javascript
  const apiError = new ApiError('An API error occurred')
  console.log(apiError.getCode()) // Outputs: undefined (unless defined in a subclass)
  ```

### `ValidationError`

- **Description**: Represents an error that occurs when validation fails. Inherits from `ApiError`.
- **Parameters**:
  - `message`: A string describing the validation error.
  - `errorResponse`: An object containing detailed validation errors, typically matching the structure of the API's response.
- **Example**:
  ```javascript
  const validationError = new ValidationError('Invalid email', {
    errors: { email: ['Invalid email address'] }
  })
  console.log(validationError.message) // Outputs: 'Invalid email'
  ```

### `InvalidValueError`

- **Description**: Used when a specific input value is invalid. Inherits from `ApiError`.
- **Parameters**:
  - `message`: A string describing the invalid value.
  - `errorResponse`: An object containing the details of the invalid input (e.g., field name).
- **Example**:
  ```javascript
  const invalidValueError = new InvalidValueError('Invalid email address', { key: 'email' })
  console.log(invalidValueError.message) // Outputs: 'Invalid email address'
  ```

### `UnauthenticatedUserError`

- **Description**: This error is thrown when a user is not authenticated (e.g., attempting to access a resource without logging in). Inherits from `ApiError`.
- **Parameters**:
  - `message`: A string describing the unauthenticated access attempt.
- **Example**:
  ```javascript
  const unauthError = new UnauthenticatedUserError('User not authenticated')
  console.log(unauthError.message) // Outputs: 'User not authenticated'
  ```

### `ServerError`

- **Description**: Represents server-side errors (e.g., 500 Internal Server Error). Inherits from `ApiError`.
- **Parameters**:
  - `message`: A string describing the server error.
- **Example**:
  ```javascript
  const serverError = new ServerError('A server error occurred')
  console.log(serverError.message) // Outputs: 'A server error occurred'
  ```

### Handling Errors in Code

You can use these error classes in your application to handle specific error scenarios, making your error handling cleaner and more structured.

#### Handling Validation Errors

```javascript
try {
  // ... validation logic
} catch (err) {
  const validationError = new ValidationError('Validation failed', { errors: err.errors })
  console.error(validationError.message) // Handle the error appropriately
}
```

#### Handling Server Errors

```javascript
try {
  // ... server logic
} catch (err) {
  const serverError = new ServerError('An unexpected server error occurred')
  console.error(serverError.message) // Handle the error appropriately
}
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss your proposed changes. Make sure to update tests where applicable.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
