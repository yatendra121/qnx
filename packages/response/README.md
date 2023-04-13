# @qnx/errors

@qnx/response is a library for handling HTTP responses in Express.js applications. It provides a standardized way of formatting and sending responses, with built-in support for error handling and validation.

### Core features:

**Standardized response formatting:** @qnx/response provides a consistent way of formatting responses, with a common structure for all responses that includes data, metadata, and errors.

**Validation:** @qnx/response integrates with popular validation libraries like Zod and express-validator, making it easy to handle validation errors in a consistent It automatically returns error responses if validation fails.

**No try-catch blocks:** @qnx/response handles errors and exceptions automatically, removing the need to write try-catch blocks in your code. This reduces the amount of boilerplate code and makes your code cleaner and easier to read.

**Error handling:** @qnx/response makes it easy to handle errors in a consistent way, with built-in support for common error types like 404 (Not Found) and 500 (Internal Server Error).

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

## Usage

To use @qnx/response, you first need to import it into your Node.js application:

```
import { ApiResponse, ApiResponseErrors, ApiResponseError } from '@qnx/response';
```

#### Creating an API response

To create an API response, you can use the ApiResponse class. You can create a new instance of the class and set the response properties using the various methods available:

```
const response = new ApiResponse();

response.setData({ message: 'Hello, world!' })
  .setMessage('Success')
  .response(res);
```

The above code creates a new ApiResponse instance, sets the data property to an object with a message property, sets the message property to 'Success', and sends the response using the response method.

#### Handling errors

@qnx/response also provides a way to handle errors in your API responses. You can use the ApiResponseErrors interface to define an object that contains the errors, and the ApiResponseError interface to define a single error.

```
interface LoginRequest {
  email: string;
  password: string;
}

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  '/login',
  validateRequest(loginRequestSchema),
  asyncValidatorHandler(async (req: Request<unknown, unknown, LoginRequest>) => {
    const { email, password } = req.body;
    const user = await UserModel.findUnique({
      where: {
        email,
      },
    });

    if (!user || !compareSync(password, user.password)) {
      const error: ApiResponseError = {
        message: 'Invalid email or password.',
        code: 'invalid_credentials',
      };
      throw new ApiResponseErrors({ login: [error] });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || '',
    );

    return initializeApiResponse()
      .setData({ token })
      .setMessage('Login successful.')
      .response(res);
  }),
);

```

The above code shows an example of how to handle errors in an API response using @qnx/response. In this example, we define a LoginRequest interface and use zod to validate the request body. If the request is invalid, the validateRequest middleware will throw an error with the validation errors, which will be caught by asyncValidatorHandler.

Inside asyncValidatorHandler, we check if the user exists and if the password is correct. If not, we create a new ApiResponseError instance and throw a new ApiResponseErrors instance with the error inside.

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
