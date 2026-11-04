import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createMcpHttpHandler, type McpHttpHandlerOptions } from './transport'

describe('createMcpHttpHandler (HTTP transport)', () => {
    let httpServer: Server
    let baseUrl: string
    let client: Client | undefined

    beforeEach(async () => {
        const app = express()
        app.use(express.json())
        app.all('/mcp', createMcpHttpHandler())

        await new Promise<void>((resolve) => {
            httpServer = app.listen(0, resolve) as Server
        })

        const { port } = httpServer.address() as AddressInfo
        baseUrl = `http://localhost:${port}/mcp`
    })

    afterEach(async () => {
        await client?.close()
        client = undefined
        await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    })

    // ─── invalid requests ─────────────────────────────────────────────────────

    describe('invalid requests', () => {
        it('returns 400 for a POST without session and non-initialize body', async () => {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
            })
            expect(res.status).toBe(400)
            const body = await res.json() as { error: string }
            expect(body.error).toBeDefined()
        })

        it('returns 404 for a POST with an unknown session ID', async () => {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'mcp-session-id': 'non-existent-session-id'
                },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
            })
            expect(res.status).toBe(404)
        })

        it('returns 400 for a GET without a session', async () => {
            const res = await fetch(baseUrl, { method: 'GET' })
            expect(res.status).toBe(400)
        })
    })

    // ─── MCP protocol over HTTP ───────────────────────────────────────────────

    describe('MCP protocol over HTTP', () => {
        async function connectClient(url = baseUrl) {
            client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
            const transport = new StreamableHTTPClientTransport(new URL(url))
            await client.connect(transport)
            return client
        }

        it('initializes a session and lists all default tools', async () => {
            const c = await connectClient()
            const { tools } = await c.listTools()
            expect(tools.length).toBe(14)
        })

        it('lists expected tool names after initialization', async () => {
            const c = await connectClient()
            const { tools } = await c.listTools()
            const names = tools.map((t) => t.name)
            expect(names).toContain('build-api-response')
            expect(names).toContain('build-api-error')
            expect(names).toContain('get-crypto-docs')
            expect(names).toContain('list-mcp-tools')
        })

        it('calls build-api-response and receives response data over HTTP', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-response',
                arguments: { type: 'success', message: 'HTTP test passed' }
            })

            expect(result.isError).toBeFalsy()
            const content = result.content[0] as { type: string; text: string }
            expect(content.type).toBe('text')
            const data = JSON.parse(content.text)
            expect(data.statusCode).toBe(200)
            expect(data.body.message).toBe('HTTP test passed')
        })

        it('calls build-api-error and receives error data over HTTP', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-error',
                arguments: {
                    errorClass: 'ServerError',
                    message: 'Something went wrong'
                }
            })

            expect(result.isError).toBeFalsy()
            const data = JSON.parse((result.content[0] as { type: string; text: string }).text)
            expect(data.errorClass).toBe('ServerError')
            expect(data.code).toBeDefined()
        })

        it('calls get-crypto-docs and receives documentation over HTTP', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'get-crypto-docs',
                arguments: { topic: 'jwt' }
            })

            expect(result.isError).toBeFalsy()
            const content = result.content[0] as { type: string; text: string }
            expect(content.type).toBe('text')
            expect(content.text.length).toBeGreaterThan(50)
        })
    })

    // ─── per-route config ─────────────────────────────────────────────────────

    describe('per-route config', () => {
        it('crypto-only route exposes list-mcp-tools + 2 crypto tools', async () => {
            const app = express()
            app.use(express.json())
            app.all('/mcp/crypto', createMcpHttpHandler({ crypto: true }))

            const cryptoServer = await new Promise<Server>((resolve) => {
                const s = app.listen(0, () => resolve(s as Server))
            })

            const { port } = cryptoServer.address() as AddressInfo
            const cryptoUrl = `http://localhost:${port}/mcp/crypto`

            const cryptoClient = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })
            const transport = new StreamableHTTPClientTransport(new URL(cryptoUrl))
            await cryptoClient.connect(transport)

            const { tools } = await cryptoClient.listTools()
            expect(tools).toHaveLength(3)
            expect(tools.map((t) => t.name)).toContain('list-mcp-tools')
            expect(tools.map((t) => t.name)).toContain('get-crypto-docs')
            expect(tools.map((t) => t.name)).toContain('build-crypto-snippet')

            await cryptoClient.close()
            await new Promise<void>((resolve) => cryptoServer.close(() => resolve()))
        })

        it('errors-only route exposes list-mcp-tools + 2 error tools', async () => {
            const app = express()
            app.use(express.json())
            app.all('/mcp/errors', createMcpHttpHandler({ errors: true }))

            const errorsServer = await new Promise<Server>((resolve) => {
                const s = app.listen(0, () => resolve(s as Server))
            })

            const { port } = errorsServer.address() as AddressInfo
            const errorsUrl = `http://localhost:${port}/mcp/errors`

            const errorsClient = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })
            const transport = new StreamableHTTPClientTransport(new URL(errorsUrl))
            await errorsClient.connect(transport)

            const { tools } = await errorsClient.listTools()
            expect(tools).toHaveLength(3)
            expect(tools.map((t) => t.name)).toContain('list-mcp-tools')
            expect(tools.map((t) => t.name)).toContain('build-api-error')

            await errorsClient.close()
            await new Promise<void>((resolve) => errorsServer.close(() => resolve()))
        })
    })
})

describe('createMcpHttpHandler options', () => {
    const servers: Server[] = []
    const streams: AbortController[] = []
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    async function start(options: McpHttpHandlerOptions) {
        const app = express()
        app.use(express.json())
        app.all('/mcp', createMcpHttpHandler(undefined, options))
        const server = await new Promise<Server>((resolve) => {
            const s = app.listen(0, () => resolve(s as Server))
        })
        servers.push(server)
        return `http://localhost:${(server.address() as AddressInfo).port}/mcp`
    }

    function initialize(url: string, extraHeaders: Record<string, string> = {}) {
        return fetch(url, {
            method: 'POST',
            headers: { ...headers, ...extraHeaders },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test', version: '1.0.0' }
                }
            })
        })
    }

    /** Opens a session and waits for its initialize request to finish. */
    async function openSession(url: string) {
        const res = await initialize(url)
        await res.text()
        await sleep(10)
        return res.headers.get('mcp-session-id') as string
    }

    async function ping(url: string, sessionId: string) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { ...headers, 'mcp-session-id': sessionId },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' })
        })
        await res.text()
        return res.status
    }

    afterEach(async () => {
        streams.splice(0).forEach((stream) => stream.abort())
        await Promise.all(
            servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve)))
        )
    })

    describe('authToken', () => {
        it.each([
            ['no header', {}],
            ['a wrong token', { Authorization: 'Bearer wrong' }],
            ['a different scheme', { Authorization: 'Basic secret' }]
        ])('answers 401 for %s', async (_label, extraHeaders) => {
            const res = await initialize(await start({ authToken: 'secret' }), extraHeaders)
            expect(res.status).toBe(401)
            expect(res.headers.get('www-authenticate')).toBe('Bearer')
        })

        it('lets a real client through with the right token', async () => {
            const url = await start({ authToken: 'secret' })
            const client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })
            await client.connect(
                new StreamableHTTPClientTransport(new URL(url), {
                    requestInit: { headers: { Authorization: 'Bearer secret' } }
                })
            )
            expect((await client.listTools()).tools).toHaveLength(14)
            await client.close()
        })

        it('protects an existing session too', async () => {
            const url = await start({ authToken: 'secret' })
            const res = await initialize(url, { Authorization: 'Bearer secret' })
            await res.text()
            expect(await ping(url, res.headers.get('mcp-session-id') as string)).toBe(401)
        })
    })

    describe('session limits', () => {
        it('closes expired sessions when a new one starts', async () => {
            const url = await start({ sessionIdleTtlMs: 20 })
            const first = await openSession(url)
            expect(await ping(url, first)).toBe(200)

            await sleep(40)
            const second = await openSession(url)

            expect(await ping(url, first)).toBe(404)
            expect(await ping(url, second)).toBe(200)
        })

        it('keeps a session that is still in use', async () => {
            const url = await start({ sessionIdleTtlMs: 60_000 })
            const first = await openSession(url)
            await openSession(url)
            expect(await ping(url, first)).toBe(200)
        })

        it('closes the least recently used session when full', async () => {
            const url = await start({ maxSessions: 2 })
            const oldest = await openSession(url)
            const used = await openSession(url)
            await sleep(5)
            expect(await ping(url, oldest)).toBe(200)
            await sleep(5)
            expect(await ping(url, used)).toBe(200)
            await sleep(5)

            const newest = await openSession(url)

            expect(await ping(url, oldest)).toBe(404)
            expect(await ping(url, used)).toBe(200)
            expect(await ping(url, newest)).toBe(200)
        })

        it('answers 503 rather than close a session with an open event stream', async () => {
            const url = await start({ maxSessions: 1, sessionIdleTtlMs: 1 })
            const sessionId = await openSession(url)
            const stream = new AbortController()
            streams.push(stream)
            await fetch(url, {
                headers: { Accept: 'text/event-stream', 'mcp-session-id': sessionId },
                signal: stream.signal
            })
            await sleep(10)

            const blocked = await initialize(url)
            expect(blocked.status).toBe(503)
            expect(await ping(url, sessionId)).toBe(200)

            stream.abort()
            await sleep(20)

            const allowed = await initialize(url)
            await allowed.text()
            expect(allowed.status).toBe(200)
        })
    })
})
