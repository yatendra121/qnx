# @qnx/errors

@qnx/errors is providing components to simplify your codes.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/errors.

```bash
npm install @qnx/errors
```

You can also use [yarn](https://yarnpkg.com/) & [pnpm](https://pnpm.io/)

```bash
yarn add @qnx/errors
```

```bash
pnpm install @qnx/errors
```

## Usage

```python
import { ApiError, ValidationError, UnauthenticateUserError, ServerError } from '@qnx/errors';

# Creating a custom error instance
const customError = new ApiError('Custom error message', 400, { errors: { email: ['Invalid email'] } });

Handling validation errors
try {
  // ... perform validation
} catch (err) {
  const validationError = new ValidationError('Validation failed', { errors: err.errors });
  // ... handle validation error
}

Handling server errors
try {
  // ... perform server action
} catch (err) {
  const serverError = new ServerError('Server error occurred');
  // ... handle server error
}


```

ApiError: An optional object that contains additional information about the error. This object should follow the structure of the ErrorResponse interface.
This class provides two methods:

getCode(): Returns the HTTP error code.
getErrorResponse(): Returns the error response object.
ValidationError
This class is used to represent validation errors. It inherits from the ApiError class and takes two parameters:

message: A string that describes the validation error.
errorResponse: An object that contains validation error messages. This object should follow the structure of the ApiResponseErrors type.
UnauthenticateUserError
This class is used to represent errors that occur when a user is not authenticated. It inherits from the ApiError class and takes one parameter:

message: A string that describes the unauthenticated user error.
ServerError
This class is used to represent errors that occur on the server side. It inherits from the ApiError class and takes one parameter:

message: A string that describes the server error.

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
