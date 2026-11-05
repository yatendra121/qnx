import express, { type NextFunction, type Request, type Response } from 'express'
import packageJson from '../../package.json'
import { jsonRpcError, createMcpHttpHandler, type McpHttpHandlerOptions } from './transport'
import { packageScopes } from './server'

const DOCS_URL = 'https://github.com/yatendra121/qnx/tree/main/packages/mcp'

/** Large enough for the source files review-code and transform-to-async-handler accept. */
const MAX_BODY_SIZE = '1mb'

const endpoints = ['/mcp', ...packageScopes.map((scope) => `/mcp/${scope}`)]

/**
 * Allows browser-based MCP clients. The server holds no user data and doesn't read cookies,
 * so a page on another origin can't use a visitor's browser to reach anything private.
 */
function allowBrowserClients(req: Request, res: Response, next: NextFunction) {
    res.set('Access-Control-Allow-Origin', '*')
    if (req.method !== 'OPTIONS') return next()
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID'
    )
    res.set('Access-Control-Max-Age', '86400')
    res.status(204).end()
}

/** Express's default error page is HTML, which a JSON-RPC client can't read. */
function jsonRpcErrors(err: Error & { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) return next(err)
    if (err.type === 'entity.parse.failed') {
        res.status(400).json(jsonRpcError(-32700, 'Parse error: the request body is not valid JSON.'))
        return
    }
    if (err.type === 'entity.too.large') {
        res.status(413).json(jsonRpcError(-32600, `Request body is larger than ${MAX_BODY_SIZE}.`))
        return
    }
    console.error(err)
    res.status(err.status ?? 500).json(jsonRpcError(-32603, 'Internal server error.'))
}

export function createMcpHttpApp(options: McpHttpHandlerOptions = {}) {
    const app = express()
    app.use(allowBrowserClients)
    app.use(express.json({ limit: MAX_BODY_SIZE }))

    app.get('/', (_req, res) => {
        res.json({
            name: 'qnx-mcp',
            version: packageJson.version,
            description: 'MCP server for the @qnx/* Node.js and TypeScript packages.',
            endpoints,
            docs: DOCS_URL
        })
    })

    app.all('/mcp', createMcpHttpHandler(undefined, options))
    for (const scope of packageScopes) {
        app.all(`/mcp/${scope}`, createMcpHttpHandler({ [scope]: true }, options))
    }

    app.use((req, res) => {
        res.status(404).json({ error: `No MCP endpoint at ${req.path}.`, endpoints, docs: DOCS_URL })
    })
    app.use(jsonRpcErrors)

    return app
}
