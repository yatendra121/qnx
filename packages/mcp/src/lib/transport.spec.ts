import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createMcpHttpApp } from './app'
import { createMcpHttpHandler } from './transport'

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

    describe('requests that need no handshake', () => {
        const post = (body: unknown, headers: Record<string, string> = {}) => fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
            body: JSON.stringify(body)
        })

        it('answers tools/list without initialize, as plain JSON', async () => {
            const res = await post({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toContain('application/json')
            const body = await res.json() as { result: { tools: unknown[] } }
            expect(body.result.tools.length).toBeGreaterThan(0)
        })

        it('issues no session id', async () => {
            const res = await post({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } }
            })
            expect(res.status).toBe(200)
            expect(res.headers.get('mcp-session-id')).toBeNull()
        })

        it('still serves a client holding a session id from an older server', async () => {
            const res = await post({ jsonrpc: '2.0', method: 'tools/list', id: 1 }, { 'mcp-session-id': 'from-before-the-upgrade' })
            expect(res.status).toBe(200)
        })

        it('answers 405 with JSON for GET and DELETE, which clients treat as not offered', async () => {
            for (const method of ['GET', 'DELETE']) {
                const res = await fetch(baseUrl, { method })
                expect(res.status).toBe(405)
                expect(res.headers.get('allow')).toBe('POST')
                expect(await res.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32000 } })
            }
        })
    })

    describe('MCP protocol over HTTP', () => {
        async function connectClient(url = baseUrl) {
            client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
            const transport = new StreamableHTTPClientTransport(new URL(url))
            await client.connect(transport)
            return client
        }

        it('initializes and lists all default tools', async () => {
            const c = await connectClient()
            const { tools } = await c.listTools()
            expect(tools.length).toBe(19)
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
        it('crypto-only route exposes the general tools + 2 crypto tools', async () => {
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
            expect(tools).toHaveLength(8)
            expect(tools.map((t) => t.name)).toContain('list-mcp-tools')
            expect(tools.map((t) => t.name)).toContain('get-crypto-docs')
            expect(tools.map((t) => t.name)).toContain('build-crypto-snippet')

            await cryptoClient.close()
            await new Promise<void>((resolve) => cryptoServer.close(() => resolve()))
        })

        it('errors-only route exposes the general tools + 2 error tools', async () => {
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
            expect(tools).toHaveLength(8)
            expect(tools.map((t) => t.name)).toContain('list-mcp-tools')
            expect(tools.map((t) => t.name)).toContain('build-api-error')

            await errorsClient.close()
            await new Promise<void>((resolve) => errorsServer.close(() => resolve()))
        })
    })
})

describe('createMcpHttpHandler authToken', () => {
    let httpServer: Server
    let baseUrl: string
    const clients: Client[] = []

    beforeEach(async () => {
        const app = express()
        app.use(express.json())
        app.all('/mcp', createMcpHttpHandler(undefined, { authToken: 'secret-token' }))
        await new Promise<void>((resolve) => {
            httpServer = app.listen(0, resolve) as Server
        })
        baseUrl = `http://localhost:${(httpServer.address() as AddressInfo).port}/mcp`
    })

    afterEach(async () => {
        await Promise.all(clients.splice(0).map((client) => client.close()))
        await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    })

    it('rejects a missing or wrong token with 401', async () => {
        for (const headers of [{}, { Authorization: 'Bearer wrong' }] as Record<string, string>[]) {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
            })
            expect(res.status).toBe(401)
            expect(res.headers.get('www-authenticate')).toBe('Bearer')
        }
    })

    it('lets a real client through with the right token', async () => {
        const client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })
        clients.push(client)
        await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl), {
            requestInit: { headers: { Authorization: 'Bearer secret-token' } }
        }))
        const { tools } = await client.listTools()
        expect(tools.length).toBeGreaterThan(0)
    })
})

/**
 * Hosted deployments run several instances, and the platform decides which one gets each request.
 * Sessions held in one instance's memory made that fail with 404, mostly during parallel tool calls.
 */
describe('several server instances behind one URL', () => {
    const servers: Server[] = []
    const clients: Client[] = []

    afterEach(async () => {
        await Promise.all(clients.splice(0).map((client) => client.close()))
        await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))))
    })

    async function startInstance() {
        const server = await new Promise<Server>((done) => {
            const started = createMcpHttpApp().listen(0, () => done(started as Server))
        })
        servers.push(server)
        return (server.address() as AddressInfo).port
    }

    /** Sends each request to the next instance, as a load balancer can. */
    async function startRoundRobin(instancePorts: number[]) {
        let next = 0
        const balancer = createServer((incoming, outgoing) => {
            const port = instancePorts[next++ % instancePorts.length]
            const proxied = httpRequest({ port, path: incoming.url, method: incoming.method, headers: incoming.headers }, (response) => {
                outgoing.writeHead(response.statusCode ?? 500, response.headers)
                response.pipe(outgoing)
            })
            incoming.pipe(proxied)
        })
        await new Promise<void>((done) => balancer.listen(0, done))
        servers.push(balancer)
        return `http://127.0.0.1:${(balancer.address() as AddressInfo).port}/mcp`
    }

    it('completes parallel calls from the official SDK client, whichever instance answers', async () => {
        const url = await startRoundRobin(await Promise.all([startInstance(), startInstance(), startInstance()]))
        const client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })
        clients.push(client)
        await client.connect(new StreamableHTTPClientTransport(new URL(url)))

        for (let round = 0; round < 4; round++) {
            const results = await Promise.allSettled(Array.from({ length: 20 }, () =>
                client.callTool({ name: 'get-console-log-docs', arguments: { topic: 'usage' } })
            ))
            expect(results.filter(({ status }) => status === 'rejected')).toEqual([])
        }
    })
})

describe('createMcpHttpApp', () => {
    let httpServer: Server
    let origin: string

    beforeEach(async () => {
        await new Promise<void>((resolve) => {
            httpServer = createMcpHttpApp().listen(0, resolve) as Server
        })
        origin = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`
    })

    afterEach(async () => {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    })

    const initialize = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } }
    }
    const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }

    it('answers malformed JSON with a JSON-RPC parse error, not an HTML page', async () => {
        const res = await fetch(`${origin}/mcp`, { method: 'POST', headers: jsonHeaders, body: '{not json' })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ jsonrpc: '2.0', id: null, error: { code: -32700, message: expect.stringContaining('not valid JSON') } })
    })

    it('answers an unknown path with JSON listing the endpoints', async () => {
        const res = await fetch(`${origin}/mcp/bogus`, { method: 'POST', headers: jsonHeaders, body: '{}' })
        expect(res.status).toBe(404)
        const body = await res.json() as { endpoints: string[] }
        expect(body.endpoints).toContain('/mcp/response')
    })

    it('describes itself at the root', async () => {
        const res = await fetch(origin)
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ name: 'qnx-mcp', endpoints: expect.arrayContaining(['/mcp']) })
    })

    it('accepts a request large enough to review a source file', async () => {
        const code = `// ${'x'.repeat(150_000)}`
        const res = await fetch(`${origin}/mcp`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'review-code', arguments: { code } } })
        })
        expect(res.status).toBe(200)
    })

    it('answers a body over the limit with JSON', async () => {
        const res = await fetch(`${origin}/mcp`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ code: 'x'.repeat(2_000_000) }) })
        expect(res.status).toBe(413)
        expect(await res.json()).toMatchObject({ error: { code: -32600 } })
    })

    it('allows browser clients through CORS preflight', async () => {
        const res = await fetch(`${origin}/mcp`, {
            method: 'OPTIONS',
            headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
        })
        expect(res.status).toBe(204)
        expect(res.headers.get('access-control-allow-origin')).toBe('*')
        expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
    })

    it.each([
        ['/mcp', 'search-docs', true],
        ['/mcp/response', 'get-response-docs', true],
        ['/mcp/response', 'get-crypto-docs', false],
        ['/mcp/log', 'build-console-log', true]
    ])('%s exposes %s: %s', async (path, tool, expected) => {
        const res = await fetch(origin + path, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
        const body = await res.json() as { result: { tools: { name: string }[] } }
        expect(body.result.tools.some(({ name }) => name === tool)).toBe(expected)
    })

    it('sends instructions, and promises no list change notifications', async () => {
        const res = await fetch(`${origin}/mcp`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(initialize) })
        const body = await res.json() as { result: { instructions: string; capabilities: { tools: { listChanged: boolean } } } }
        expect(body.result.instructions).toContain('diagnose-error')
        expect(body.result.capabilities.tools.listChanged).toBe(false)
    })
})
