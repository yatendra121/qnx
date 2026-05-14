# `@qnx/log`

`@qnx/log` provides a console logger using the [Chalk](https://www.npmjs.com/package/chalk) library for colorful output. It supports different message types — `info`, `error`, `success`, and `warning` — each rendered in a distinct color.

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/log`

| Tool | Description |
| --- | --- |
| `get-console-log-docs` | Documentation for usage, message types, and patterns |
| `build-console-log` | Preview console output and get the consoleLog() call |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

**Configuration:**
```json
{
  "mcpServers": {
    "qnx-log": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/log"
    }
  }
}
```

## ✨ Features

- Colorized console output via Chalk
- Four built-in message types: `info`, `error`, `success`, `warning`
- Simple, minimal API

## 📦 Installation

Install via your preferred package manager:

```bash
# npm
npm install @qnx/log

# yarn
yarn add @qnx/log

# pnpm
pnpm install @qnx/log
```

### Peer Dependencies

This package requires `chalk` as a peer dependency:

```bash
npm install chalk
```

## 🚀 Usage

```ts
import { consoleLog } from '@qnx/log'

consoleLog('Server started', { type: 'info' })
consoleLog('An error occurred!', { type: 'error' })
consoleLog('Operation successful', { type: 'success' })
consoleLog('Proceed with caution', { type: 'warning' })
```

The `type` option defaults to `'info'` if omitted:

```ts
consoleLog('This is an informational message')
```

## 🤝 Contributing

Pull requests are welcome!
For major changes, please open an issue first to discuss what you'd like to change.
Make sure to update or add tests where appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
