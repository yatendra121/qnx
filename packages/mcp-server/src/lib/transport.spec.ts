import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
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

        it('returns 400 for a POST with an unknown session ID', async () => {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'mcp-session-id': 'non-existent-session-id'
                },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
            })
            expect(res.status).toBe(400)
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
            expect(tools.length).toBe(13)
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
        it('crypto-only route exposes exactly 2 tools', async () => {
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
            expect(tools).toHaveLength(2)
            expect(tools.map((t) => t.name)).toContain('get-crypto-docs')
            expect(tools.map((t) => t.name)).toContain('build-crypto-snippet')

            await cryptoClient.close()
            await new Promise<void>((resolve) => cryptoServer.close(() => resolve()))
        })

        it('errors-only route exposes exactly 2 tools', async () => {
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
            expect(tools).toHaveLength(2)
            expect(tools.map((t) => t.name)).toContain('build-api-error')

            await errorsClient.close()
            await new Promise<void>((resolve) => errorsServer.close(() => resolve()))
        })
    })
})
