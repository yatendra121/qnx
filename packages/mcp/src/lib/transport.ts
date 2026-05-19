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

        res.status(400).json({ error: 'Invalid MCP request' })
    }
}
