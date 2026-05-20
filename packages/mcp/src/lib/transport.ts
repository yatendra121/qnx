import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import type { Request, Response } from 'express'
import { createMcpServer, McpServerConfig } from './server'

export function createMcpHttpHandler(config?: McpServerConfig) {
    const transports = new Map<string, StreamableHTTPServerTransport>()

    return async function mcpHttpHandler(req: Request, res: Response) {
        const sessionId = req.headers['mcp-session-id'] as string | undefined

        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId)!
            await transport.handleRequest(req, res, req.body)
            return
        }

        if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
            const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => crypto.randomUUID(),
                onsessioninitialized: (id): void => { transports.set(id, transport) }
            })

            transport.onclose = () => {
                if (transport.sessionId) transports.delete(transport.sessionId)
            }

            const server = createMcpServer(config)
            await server.connect(transport)
            await transport.handleRequest(req, res, req.body)
            return
        }

        if (sessionId && !transports.has(sessionId)) {
            res.status(400).json({
                error: 'Session not found. The mcp-session-id header is present but does not match any active session. Re-initialize: POST {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"client","version":"1.0.0"}}}'
            })
            return
        }

        res.status(400).json({
            error: 'MCP handshake required. Complete these steps first: (1) POST initialize to get mcp-session-id, (2) POST notifications/initialized with that header, (3) include mcp-session-id on all subsequent requests. See: https://github.com/yatendra121/qnx/tree/main/packages/mcp'
        })
    }
}
