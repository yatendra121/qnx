import { createHash, timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Request, Response } from 'express'
import { createMcpServer, McpServerConfig } from './server'

export interface McpHttpHandlerOptions {
    /** Bearer token every request must send. Leave unset for a public server. */
    authToken?: string
}

function hasValidToken(req: Request, authToken: string) {
    // Hashing gives both sides the same length, which timingSafeEqual requires.
    const digest = (value: string) => createHash('sha256').update(value).digest()
    return timingSafeEqual(digest(req.headers.authorization ?? ''), digest(`Bearer ${authToken}`))
}

export function jsonRpcError(code: number, message: string) {
    return { jsonrpc: '2.0', id: null, error: { code, message } }
}

/**
 * Serves MCP over Streamable HTTP in stateless mode: each POST gets its own server and transport.
 *
 * Every tool is a pure function, so a session would hold nothing. Sessions kept in memory also break
 * on any host that runs several instances: a request reaching an instance that didn't create the
 * session gets a 404, which is what happened to parallel tool calls on serverless hosting.
 */
export function createMcpHttpHandler(config?: McpServerConfig, options: McpHttpHandlerOptions = {}) {
    const { authToken } = options

    return async function mcpHttpHandler(req: Request, res: Response) {
        if (authToken && !hasValidToken(req, authToken)) {
            res.status(401)
                .set('WWW-Authenticate', 'Bearer')
                .json({ error: 'Missing or invalid bearer token.' })
            return
        }

        // With no sessions there is no event stream to open (GET) and nothing to close (DELETE).
        // The MCP spec has clients treat a 405 here as "this server doesn't offer that".
        if (req.method !== 'POST') {
            res.status(405)
                .set('Allow', 'POST')
                .json(jsonRpcError(-32000, 'Method not allowed. This server is stateless: send JSON-RPC requests with POST.'))
            return
        }

        const server = createMcpServer(config)
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        })

        res.once('close', () => {
            void transport.close()
            void server.close()
        })

        try {
            await server.connect(transport)
            await transport.handleRequest(req, res, req.body)
        } catch (error) {
            console.error(error)
            if (!res.headersSent) res.status(500).json(jsonRpcError(-32603, 'Internal server error.'))
        }
    }
}
