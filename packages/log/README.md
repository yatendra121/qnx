# `@qnx/log`

`@qnx/log` provides a console logger using the [Chalk](https://www.npmjs.com/package/chalk) library for colorful output. It supports six message types — `info`, `success`, `warn`, `error`, `debug`, and `trace` — each rendered in a distinct color with an outline icon.

> 🤖 MCP Server: `https://qnx-mcp-server.vercel.app/mcp/log`

## ✨ Features

- 🎨 Colorized console output via Chalk
- 📢 Six built-in message types: `info`, `success`, `warn`, `error`, `debug`, `trace` (`warning` is an alias of `warn`)
- 🧵 Errors are printed with their stack trace and `cause` chain
- 🛠️ Simple, minimal API

## 📦 Installation

```bash
# npm
npm install @qnx/log

# yarn
yarn add @qnx/log

# pnpm
pnpm install @qnx/log
```

### Peer Dependencies

```bash
npm install chalk
```

## 🚀 Usage

```ts
import { consoleLog } from '@qnx/log'

consoleLog('Server started', { type: 'info' })        // ⓘ  Server started
consoleLog('Operation successful', { type: 'success' }) // ✓  Operation successful
consoleLog('Proceed with caution', { type: 'warn' })    // ⚠  Proceed with caution
consoleLog('An error occurred!', { type: 'error' })     // ✗  An error occurred!
consoleLog('Fetching user data...', { type: 'debug' })  // ◇  Fetching user data...
consoleLog('Request ID: 7f3a2b1e', { type: 'trace' })   // ☆  Request ID: 7f3a2b1e
```

Pass an `Error` (for example, straight from a `catch` block) to print its stack trace and `cause` chain:

```ts
try {
    await connect()
} catch (err) {
    consoleLog(err, { type: 'error' })
}
// ✗  Error: Failed to connect to database
//     at connect (db.ts:12:11)
// Caused by: Error: ECONNREFUSED 127.0.0.1:5432
//     at ...
```

Other values (objects, numbers, …) are converted to text; plain objects are JSON-formatted.

The `type` option defaults to `'info'` if omitted:

```ts
consoleLog('This is an informational message')
```

---

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/log`

| Tool | Description |
| ---- | ----------- |
| `get-console-log-docs` | Documentation for usage, message types, and patterns |
| `build-console-log` | Preview console output and get the consoleLog() call |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

### HTTP (Streamable HTTP)

```json
{
  "mcpServers": {
    "qnx-log": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/log"
    }
  }
}
```

### stdio (via npx)

```json
{
  "mcpServers": {
    "qnx-log": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp", "log"]
    }
  }
}
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
