# @qnx/log

@qnx/log provides a console logger using the Chalk library for colorful output. It supports different types of messages such as 'info', 'error', 'success', and 'warning', each associated with a specific color.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @qnx/log.

```bash
npm install -D @qnx/log
```

You can also use [yarn](https://yarnpkg.com/) & [pnpm](https://pnpm.io/)

```bash
yarn add -D @qnx/log
```

```bash
pnpm install -D @qnx/log
```

#### Peer-Dependencies

@qnx/response is using error instances of @qnx/errors.

```bash
npm install -D chalk
```

## Usage

Import the module and use the consoleLog function to log messages with different types and corresponding colors.

```javascript
import { consoleLog } from '@qnx/log'

// Example usage
consoleLog('This is an informational message', { type: 'info' })
consoleLog('An error occurred!', { type: 'error' })
consoleLog('Operation successful', { type: 'success' })
consoleLog('Warning: Proceed with caution', { type: 'warning' })
```

The consoleLog function takes a string message and an optional configuration object, allowing you to specify the message type. The default type is 'info'.

```javascript
import { consoleLog } from '@qnx/log'

consoleLog('This is an informational message')
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT License](https://github.com/yatendra121/log/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
