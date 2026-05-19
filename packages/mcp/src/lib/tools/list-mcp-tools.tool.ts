import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const toolsReference = `# QNX MCP Server — Available Tools

## \`@qnx/errors\`
| Tool | Type | Purpose |
| --- | --- | --- |
| \`get-error-class-docs\` | docs | Constructor signature, methods, examples, and when to use each error class |
| \`build-api-error\` | build | Instantiate an error class with real values — preview resolved code + errorResponse |

## \`@qnx/response\`
| Tool | Type | Purpose |
| --- | --- | --- |
| \`get-response-docs\` | docs | Code examples for handler setup, success, validation errors, Zod, unauthenticated, resource routes |
| \`build-api-response\` | build | Show HTTP status code, response body shape, and which @qnx/response function produces it |

## \`@qnx/client\`
| Tool | Type | Purpose |
| --- | --- | --- |
| \`get-client-docs\` | docs | ApiResponse, ApiSuccessResponse, ApiErrorResponse classes, TypeScript types, and usage patterns |
| \`build-client-response\` | build | Instantiate a response class with real values — see what each method returns |

## \`@qnx/crypto\`
| Tool | Type | Purpose |
| --- | --- | --- |
| \`get-crypto-docs\` | docs | JWT, JWE, auth token helpers, key helpers, and supported algorithms |
| \`build-crypto-snippet\` | build | Generate a TypeScript snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt |

## \`@qnx/winston\` (file logger)
| Tool | Type | Purpose |
| --- | --- | --- |
| \`get-file-logger-docs\` | docs | Usage, log levels, file output format, configuration, and patterns |
| \`build-file-log-entry\` | build | Preview the JSON log entry written to file for a given level, message, and metadata |

## \`@qnx/log\` (console logger)
| Tool | Type | Purpose |
| --- | --- | --- |
| \`get-console-log-docs\` | docs | Usage, message types (info/error/success/warning), and patterns |
| \`build-console-log\` | build | Preview console output and get the consoleLog() call |

---

## Tool Types
| Type | When to use |
| --- | --- |
| \`docs\` | Get documentation, examples, and API reference for a package |
| \`build\` | Instantiate or generate with real values — preview output or get a ready-to-paste code snippet |`

export function registerListMcpToolsTool(server: McpServer) {
    server.registerTool(
        'list-mcp-tools',
        {
            description: 'List all available QNX MCP tools grouped by package. Call this first to discover what tools are available before working with any @qnx/* package.'
        },
        async () => ({
            content: [{ type: 'text', text: toolsReference }]
        })
    )
}
