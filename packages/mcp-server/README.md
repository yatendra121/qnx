# `@qnx/mcp-server`

`@qnx/mcp-server` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the qnx ecosystem as AI-callable tools. It supports both **HTTP (Streamable HTTP)** and **stdio** transports and is publicly hosted at:

```
https://qnx-mcp-server.vercel.app/mcp
```

## 🛣️ Routes & Tools

Each route scopes the server to a specific package. Use `/mcp` to get everything, or connect to a scoped endpoint to keep the tool list minimal.

| Route | Package | Tools |
| --- | --- | --- |
| `/mcp` | all | All 13 tools |
| `/mcp/errors` | `@qnx/errors` | `get-error-class-docs`, `build-api-error` |
| `/mcp/response` | `@qnx/response` | `get-response-docs`, `build-api-response` |
| `/mcp/client` | `@qnx/client` | `get-client-docs`, `build-client-response` |
| `/mcp/crypto` | `@qnx/crypto` | `get-crypto-docs`, `build-crypto-snippet` |
| `/mcp/winston` | `@qnx/winston` | `get-file-logger-docs`, `build-file-log-entry` |
| `/mcp/log` | `@qnx/log` | `get-console-log-docs`, `build-console-log` |

### Tool reference

**`@qnx/errors`**
| Tool | Purpose |
| --- | --- |
| `get-error-class-docs` | Constructor signature, methods, examples, and when to use each error class |
| `build-api-error` | Instantiate an error class with real values — preview resolved code + errorResponse |

**`@qnx/response`**
| Tool | Purpose |
| --- | --- |
| `get-response-docs` | Code examples for handler setup, success, validation errors, Zod, unauthenticated, resource routes |
| `build-api-response` | Show HTTP status code, response body shape, and which @qnx/response function produces it |

**`@qnx/client`**
| Tool | Purpose |
| --- | --- |
| `get-client-docs` | ApiResponse, ApiSuccessResponse, ApiErrorResponse classes, TypeScript types, and usage patterns |
| `build-client-response` | Instantiate a response class with real values — see what each method returns |

**`@qnx/crypto`**
| Tool | Purpose |
| --- | --- |
| `get-crypto-docs` | JWT, JWE, auth token helpers, key helpers, and supported algorithms |
| `build-crypto-snippet` | Generate a TypeScript snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt |

**`@qnx/winston`**
| Tool | Purpose |
| --- | --- |
| `get-file-logger-docs` | Usage, log levels, file output format, configuration, and patterns |
| `build-file-log-entry` | Preview the JSON log entry written to file for a given level, message, and metadata |

**`@qnx/log`**
| Tool | Purpose |
| --- | --- |
| `get-console-log-docs` | Usage, message types (info/error/success/warning), and patterns |
| `build-console-log` | Preview console output and get the consoleLog() call |

## 🤖 AI Client Configuration

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

### HTTP

Add to your AI client's MCP config:

```json
{
  "mcpServers": {
    "qnx": {
      "url": "https://qnx-mcp-server.vercel.app/mcp"
    }
  }
}
```

Or connect to a scoped endpoint to keep the tool list focused:

```json
{
  "mcpServers": {
    "qnx-crypto": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/crypto"
    }
  }
}
```

Supported scopes: `crypto` · `response` · `errors` · `client` · `winston` · `log`

### Stdio

Add to your AI client's MCP config:

```json
{
  "mcpServers": {
    "qnx": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp-server"]
    }
  }
}
```

Or scoped to a specific package:

```json
{
  "mcpServers": {
    "qnx-crypto": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp-server", "crypto"]
    }
  }
}
```

Supported scopes: `crypto` · `response` · `errors` · `client` · `winston` · `log`

## 🤝 Contributing

Pull requests are welcome!  
For major changes, please open an issue first to discuss your proposed updates.  
Ensure tests are updated for any feature changes.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
