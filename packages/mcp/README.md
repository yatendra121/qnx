# `@qnx/mcp`

`@qnx/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the qnx ecosystem as AI-callable tools. Connect once and get instant access to docs, code generators, and migration helpers for every `@qnx/*` package.

**Hosted endpoint:**

```
https://qnx-mcp-server.vercel.app/mcp
```

## ✨ Features

- 📚 Docs tools — queryable documentation for every `@qnx/*` package
- 🔨 Build tools — generate real code snippets and preview output with actual values
- 🔄 Migration tools — before/after examples for migrating to `@qnx/*` patterns
- 🌐 Supports both **HTTP (Streamable HTTP)** and **stdio** transports
- 🎯 Scoped endpoints — connect to a single package to keep the tool list focused
- 🛠️ `list-mcp-tools` — call this first to discover everything available

## 🧰 Tool Reference

> Call `list-mcp-tools` first to get the full tool list grouped by package.

**`@qnx/errors`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-error-class-docs` | docs | Constructor signature, methods, examples, and when to use each error class |
| `build-api-error` | build | Instantiate an error class with real values — preview resolved code + errorResponse |

**`@qnx/response`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-response-docs` | docs | Code examples for handler setup, success, validation errors, Zod, unauthenticated, resource routes |
| `build-api-response` | build | Show HTTP status code, response body shape, and which @qnx/response function produces it |
| `transform-to-async-handler` | migration | Before/after migration from callback-style Express routes to asyncValidatorHandler |

**`@qnx/client`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-client-docs` | docs | ApiResponse, ApiSuccessResponse, ApiErrorResponse classes, TypeScript types, and usage patterns |
| `build-client-response` | build | Instantiate a response class with real values — see what each method returns |

**`@qnx/crypto`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-crypto-docs` | docs | JWT, JWE, auth token helpers, key helpers, and supported algorithms |
| `build-crypto-snippet` | build | Generate a TypeScript snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt |

**`@qnx/winston`** (file logger)

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-file-logger-docs` | docs | Usage, log levels, file output format, configuration, and patterns |
| `build-file-log-entry` | build | Preview the JSON log entry written to file for a given level, message, and metadata |
| `log-message` | action | Write a log entry directly via the Winston logger |

**`@qnx/log`** (console logger)

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-console-log-docs` | docs | Usage, message types (info/error/success/warning), and patterns |
| `build-console-log` | build | Preview console output and get the consoleLog() call |

---

**Tool types:**

| Type | When to use |
| ---- | ----------- |
| `docs` | Get documentation, examples, and API reference for a package |
| `build` | Generate with real values — preview output or get a ready-to-paste code snippet |
| `migration` | Before/after examples for migrating existing code to a `@qnx/*` pattern |
| `action` | Perform a live action (e.g. write a log entry) |

## 🤖 AI Client Configuration

**Supported clients:** Claude Desktop · Claude Code · Cursor · Windsurf · Cline · Continue.dev · Codex CLI · ChatGPT Desktop

### HTTP (Streamable HTTP)

Connect to the full server (all packages):

```json
{
  "mcpServers": {
    "qnx": {
      "url": "https://qnx-mcp-server.vercel.app/mcp"
    }
  }
}
```

Or use a scoped endpoint to keep the tool list focused:

```json
{
  "mcpServers": {
    "qnx-response": {
      "url": "https://qnx-mcp-server.vercel.app/mcp/response"
    }
  }
}
```

**Supported scopes:** `errors` · `response` · `client` · `crypto` · `winston` · `log`

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

### stdio (via npx)

Connect to the full server:

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

**Supported scopes:** `errors` · `response` · `client` · `crypto` · `winston` · `log`

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
