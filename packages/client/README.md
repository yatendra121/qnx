# @qnx/client

@qnx/client is providing components to simplify your codes.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/client.

```bash
npm install @qnx/client
```

You can also use [yarn](https://yarnpkg.com/) & [pnpm](https://pnpm.io/)

```bash
yarn add @qnx/client
```

```bash
pnpm install @qnx/client
```

## Usage

```bash
import { ApiResponse } from '@qnx/client'

const res = {
  data: {
    user: {
      name: "User",
      email: "test@gmail.com",
    },
  },
  errorCode: null,
  errors: null,
  error: null,
  message: null,
  serverError: null,
};

const apiRes = ApiResponse(res)

const data = apiRes.getData()
const message = apiRes.getMessage()

```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/client/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
