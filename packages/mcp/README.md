# `@qnx/mcp`

`@qnx/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the qnx ecosystem as AI-callable tools. It supports both **HTTP (Streamable HTTP)** and **stdio** transports and is publicly hosted at:

```
https://qnx-mcp-server.vercel.app/mcp
```

## Tool reference

**`list-mcp-tools`** — call this first to get the full tool list grouped by package.

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
| `transform-to-async-handler` | Before/after migration from callback-style Express routes to asyncValidatorHandler |

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
    "qnx-response": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/response"
    }
  }
}
```

Supported scopes: `crypto` · `response` · `errors` · `client` · `winston` · `log`

#### HTTP handshake (for raw HTTP / curl usage)

The MCP HTTP transport requires a 3-step sequence before any tool call:

**Step 1 — initialize**

```bash
curl -X POST https://qnx-mcp-server.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0.0"}}}'
```

Copy the `mcp-session-id` value from the response headers.

**Step 2 — confirm initialization**

```bash
curl -X POST https://qnx-mcp-server.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
```

**Step 3 — call a tool**

```bash
curl -X POST https://qnx-mcp-server.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list-mcp-tools","arguments":{}}}'
```

> **SSL note:** if your HTTP client rejects the certificate, pass `-k` (curl) or the equivalent `rejectUnauthorized: false` option. This is a Vercel infrastructure certificate — the connection is still encrypted.

### Stdio

Add to your AI client's MCP config:

```json
{
  "mcpServers": {
    "qnx": {
      "command": "npx",
      "args": ["-y", "@qnx/mcp"]
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
      "args": ["-y", "@qnx/mcp", "crypto"]
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
