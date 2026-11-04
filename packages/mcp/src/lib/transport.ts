import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import type { Request, Response } from 'express'
import { createMcpServer, McpServerConfig } from './server'

const DEFAULT_SESSION_IDLE_TTL_MS = 30 * 60 * 1000
const DEFAULT_MAX_SESSIONS = 1000

export interface McpHttpHandlerOptions {
    /** Bearer token every request must send. Leave unset for a public server. */
    authToken?: string
    /** Close a session after this long with no traffic and no open request. Defaults to 30 minutes. */
    sessionIdleTtlMs?: number
    /** Most sessions this handler keeps open. Defaults to 1000. */
    maxSessions?: number
}

interface Session {
    transport: StreamableHTTPServerTransport
    /** Requests still being answered, which includes a client's long-lived event stream. */
    openRequests: number
    lastSeen: number
}

function hasValidToken(req: Request, authToken: string) {
    // Hashing gives both sides the same length, which timingSafeEqual requires.
    const digest = (value: string) => createHash('sha256').update(value).digest()
    return timingSafeEqual(digest(req.headers.authorization ?? ''), digest(`Bearer ${authToken}`))
}

function trackRequest(session: Session, res: Response) {
    session.openRequests++
    session.lastSeen = Date.now()
    res.once('close', () => {
        session.openRequests--
        session.lastSeen = Date.now()
    })
}

export function createMcpHttpHandler(config?: McpServerConfig, options: McpHttpHandlerOptions = {}) {
    const {
        authToken,
        sessionIdleTtlMs = DEFAULT_SESSION_IDLE_TTL_MS,
        maxSessions = DEFAULT_MAX_SESSIONS
    } = options
    const sessions = new Map<string, Session>()

    /**
     * Closes expired sessions, then the least recently used ones if the handler is still full.
     * Sessions with an open request are left alone. Returns whether a new session now fits.
     */
    async function makeRoomForSession() {
        const now = Date.now()
        const idleSessions = [...sessions.values()]
            .filter((session) => session.openRequests === 0)
            .sort((a, b) => a.lastSeen - b.lastSeen)

        for (const session of idleSessions) {
            const expired = now - session.lastSeen >= sessionIdleTtlMs
            if (!expired && sessions.size < maxSessions) break
            await session.transport.close()
        }
        return sessions.size < maxSessions
    }

    return async function mcpHttpHandler(req: Request, res: Response) {
        if (authToken && !hasValidToken(req, authToken)) {
            res.status(401)
                .set('WWW-Authenticate', 'Bearer')
                .json({ error: 'Missing or invalid bearer token.' })
            return
        }

        const sessionId = req.headers['mcp-session-id'] as string | undefined

        if (sessionId) {
            const session = sessions.get(sessionId)
            if (!session) {
                // 404 is what the MCP spec tells clients to answer by starting a new session.
                res.status(404).json({
                    error: 'Session not found. The mcp-session-id header is present but does not match any active session, which may have expired. Re-initialize: POST {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"client","version":"1.0.0"}}}'
                })
                return
            }

            trackRequest(session, res)
            await session.transport.handleRequest(req, res, req.body)
            return
        }

        if (req.method === 'POST' && isInitializeRequest(req.body)) {
            if (!(await makeRoomForSession())) {
                res.status(503).json({ error: 'Too many active sessions. Try again later.' })
                return
            }

            const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id): void => {
                    const session: Session = { transport, openRequests: 0, lastSeen: Date.now() }
                    sessions.set(id, session)
                    trackRequest(session, res)
                }
            })

            transport.onclose = () => {
                if (transport.sessionId) sessions.delete(transport.sessionId)
            }

            const server = createMcpServer(config)
            await server.connect(transport)
            await transport.handleRequest(req, res, req.body)
            return
        }

        res.status(400).json({
            error: 'MCP handshake required. Complete these steps first: (1) POST initialize to get mcp-session-id, (2) POST notifications/initialized with that header, (3) include mcp-session-id on all subsequent requests. See: https://github.com/yatendra121/qnx/tree/main/packages/mcp'
        })
    }
}
