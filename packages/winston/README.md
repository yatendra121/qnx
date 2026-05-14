# @qnx/winston

`@qnx/winston` provides a pre-configured logger instance using the popular [winston](https://www.npmjs.com/package/winston) logging library. It simplifies logging setup by offering a ready-to-use logger with support for console and daily rotated file logs out of the box.

## 🤖 MCP Server

AI tools for this package are available via the [QNX MCP Server](https://qnx-mcp-server.vercel.app).

**Endpoint:** `https://qnx-mcp-server.vercel.app/mcp/winston`

| Tool | Description |
| --- | --- |
| `get-file-logger-docs` | Documentation for usage, log levels, file output format, configuration, and patterns |
| `build-file-log-entry` | Preview the JSON log entry written to file for a given level, message, and metadata |

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

**Configuration:**
```json
{
  "mcpServers": {
    "qnx-winston": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/winston"
    }
  }
}
```

## ✨ Features

- ✅ Pre-configured `winston` logger instance
- 📁 Supports daily rotated log files
- 🧾 Console and file logging formats
- 🛠️ Easy plug-and-play with minimal setup

## 📦 Installation

Install using your preferred package manager:

```bash
# npm
npm install @qnx/winston

# yarn
yarn add @qnx/winston

# pnpm
pnpm install @qnx/winston
```

### Peer Dependencies

This package requires [`winston-daily-rotate-file`](https://www.npmjs.com/package/winston-daily-rotate-file) as a peer dependency for daily file rotation:

```bash
npm install winston winston-daily-rotate-file
```

## 🚀 Usage

### Importing the Logger

```ts
import { logger } from '@qnx/winston'
```

You can now use `logger` throughout your application for consistent logging:

```ts
logger.info('Server started on port 3000')
logger.error('Something went wrong!', { error: err })
logger.debug('User data:', { user })
```

## 📂 Log Output Structure

Logs are output in two formats:

- **Console** – Pretty-printed, colorized output with timestamps
- **File** – JSON format, rotated daily

Example file structure:

```
logs/
├── app-2025-07-28.log
├── app-2025-07-29.log
└── error.log
```

## 🔧 Configuration Details

The `@qnx/winston` logger comes pre-configured with the following transports:

- **Console Transport**: For development visibility
- **Daily Rotate File Transport**: For persistent log storage

Log files are saved in a `logs` directory by default.

You can fork or wrap this library if you want to customize formats, paths, or levels.

## 🧪 Example

```ts
import { logger } from '@qnx/winston'

app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`)
  next()
})

try {
  // Some risky operation
} catch (error) {
  logger.error('Unexpected error', { error })
}
```

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
