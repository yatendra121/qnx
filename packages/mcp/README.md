# `@qnx/mcp`

`@qnx/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that brings the qnx ecosystem into your AI coding assistant. It answers questions, explains errors, checks your code and generates snippets for every `@qnx/*` package. "QNX" here means these Node.js and TypeScript packages, not the QNX operating system.

**Hosted endpoint:**

```
https://qnx-mcp-server.vercel.app/mcp
```

## ✨ Features

- 🩺 `diagnose-error` — paste an error message or stack trace to get its cause and fix
- 🔎 `search-docs` — free-text search across all docs, guides and known errors
- 🧐 `review-code` — check your code for known `@qnx/*` mistakes, with line numbers and fixes
- 🔄 `transform-to-async-handler` — migrate your Express routes, keeping their status codes
- 🧭 `get-guide` — tested end-to-end guides and a production checklist
- 🔨 Build tools — previews that run the real libraries, and snippets that are tested against them
- 📚 Docs tools — queryable documentation for every `@qnx/*` package
- 🌐 Supports both **HTTP (Streamable HTTP)** and **stdio** transports
- 🎯 Scoped endpoints — connect to a single package to keep the tool list focused

## 🧰 Tool Reference

**Start here** (available on every endpoint)

| Tool | Use it when |
| ---- | ----------- |
| `diagnose-error` | You have an error message, stack trace or surprising response. Says so when it doesn't recognise the error, rather than guessing |
| `search-docs` | You have a question. Searches docs, guides and known errors |
| `review-code` | You have code. Checks it for known mistakes. It uses pattern matching, so check its findings against your code |
| `get-guide` | You are building a feature. Covers `crud-api`, `server-and-client`, `auth-session` and `production-checklist` |
| `get-package-info` | You are choosing or installing a package: what exists, install commands, and every public export |
| `list-mcp-tools` | You want the tools on this endpoint, grouped by task and package |

`@qnx/core-helpers`, `@qnx/interfaces` and `@qnx/message` are small enough to be fully covered by `get-package-info`.

**`@qnx/errors`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-error-class-docs` | docs | Constructor signature, methods, examples, and what each error class sends to the client |
| `build-api-error` | build | Instantiate a real error class: see its code, errorResponse and HTTP response |

**`@qnx/response`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-response-docs` | docs | Handler setup, return values, success, validation, Zod, server errors, resource routes, API reference |
| `build-api-response` | build | Run the real code: see the HTTP status, response body, and the function that produces it |
| `transform-to-async-handler` | migration | Pass your route for line-by-line conversions, or a pattern for a tested before and after. Lists the behaviour changes to check |

**`@qnx/client`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-client-docs` | docs | Detecting failures reliably, response classes, TypeScript types, and usage patterns |
| `build-client-response` | build | See what each getter returns for your values |

**`@qnx/crypto`**

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-crypto-docs` | docs | Key setup, JWT, JWE, auth tokens, key helpers, algorithms, and troubleshooting |
| `build-crypto-snippet` | build | Generate a snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt. Combinations that would throw at runtime are rejected |

**`@qnx/winston`** (file logger)

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-file-logger-docs` | docs | Usage, levels, logging errors, file output format, configuration, and patterns |
| `build-file-log-entry` | build | Preview the JSON a logger call writes to the file |

**`@qnx/log`** (console logger)

| Tool | Type | Purpose |
| ---- | ---- | ------- |
| `get-console-log-docs` | docs | Usage, message types (info/success/warn/error/debug/trace), and patterns |
| `build-console-log` | build | Preview console output and get the consoleLog() call |

All tools are read-only. A call that fails its checks, such as a missing required field, returns `isError: true` with what to change.

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

#### Calling it directly (raw HTTP / curl)

The server is stateless, so there is no handshake or session to manage. Send JSON-RPC requests with `POST`. MCP clients still call `initialize` first, and that works as usual.

```bash
curl -X POST https://qnx-mcp-server.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"diagnose-error","arguments":{"error":"JWT private key is not found in environment variables."}}}'
```

Responses are JSON. `GET` and `DELETE` respond `405`, because there is no event stream to open or session to close.

> **TLS note:** the server has a standard, publicly trusted certificate, so you shouldn't need to turn off verification. If your client rejects it, a TLS-inspecting corporate proxy is the likely cause: add that proxy's certificate to your trust store rather than using `-k`.

#### Self-hosting the HTTP server

The server keeps no state between requests, so it runs on any number of instances, including serverless platforms, with no shared store or sticky sessions.

The server is open by default. Set `MCP_AUTH_TOKEN` to require `Authorization: Bearer <token>` on every request. Anything else gets a `401`.

```bash
MCP_AUTH_TOKEN=<token> node main.js
```

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

## 🧪 Testing an endpoint as a consumer

`e2e/run.mjs` tests any endpoint the way a developer would. It installs the published packages in a temporary project, runs the install commands and code the endpoint returns, compiles that code with `tsc --strict`, and reproduces real errors to check the diagnosis. Run it from the repository after each deployment:

```bash
pnpm --filter @qnx/mcp e2e https://qnx-mcp-server.vercel.app/mcp
```

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
