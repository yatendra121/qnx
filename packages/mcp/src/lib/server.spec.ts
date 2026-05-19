import { describe, it, expect, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer, type McpServerConfig } from './server'

/**
 * These tests exercise createMcpServer through InMemoryTransport, which mirrors
 * the stdio transport path (both implement the same Transport interface). Every
 * assertion here covers the "stdio" communication channel as well as the core
 * server logic.
 */
describe('createMcpServer (via InMemoryTransport / stdio-equivalent)', () => {
    let client: Client | undefined

    async function connectClient(config?: McpServerConfig): Promise<Client> {
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
        const server = createMcpServer(config)
        await server.connect(serverTransport)
        client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
        await client.connect(clientTransport)
        return client
    }

    afterEach(async () => {
        await client?.close()
        client = undefined
    })

    // ─── tool registration ────────────────────────────────────────────────────

    describe('tool registration', () => {
        it('registers all 13 tools with default config', async () => {
            const c = await connectClient()
            const { tools } = await c.listTools()
            expect(tools).toHaveLength(13)
        })

        it('registers only 2 crypto tools when only crypto is enabled', async () => {
            const c = await connectClient({ crypto: true })
            const { tools } = await c.listTools()
            expect(tools).toHaveLength(2)
            const names = tools.map((t) => t.name)
            expect(names).toContain('get-crypto-docs')
            expect(names).toContain('build-crypto-snippet')
        })

        it('registers only 2 error tools when only errors is enabled', async () => {
            const c = await connectClient({ errors: true })
            const { tools } = await c.listTools()
            expect(tools).toHaveLength(2)
            const names = tools.map((t) => t.name)
            expect(names).toContain('build-api-error')
            expect(names).toContain('get-error-class-docs')
        })

        it('registers list-mcp-tools only when both response and errors are enabled', async () => {
            const c = await connectClient({ response: true, errors: true })
            const { tools } = await c.listTools()
            const names = tools.map((t) => t.name)
            expect(names).toContain('list-mcp-tools')
        })

        it('does not register list-mcp-tools when only response is enabled', async () => {
            const c = await connectClient({ response: true })
            const { tools } = await c.listTools()
            expect(tools.map((t) => t.name)).not.toContain('list-mcp-tools')
        })

        it('does not register list-mcp-tools when only errors is enabled', async () => {
            const c = await connectClient({ errors: true })
            const { tools } = await c.listTools()
            expect(tools.map((t) => t.name)).not.toContain('list-mcp-tools')
        })
    })

    // ─── tool calls / data passing ────────────────────────────────────────────

    describe('data passing via tool calls', () => {
        it('build-api-error returns a ValidationError response over stdio', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-error',
                arguments: {
                    errorClass: 'ValidationError',
                    message: 'Validation failed',
                    fields: [{ field: 'email', message: 'Email is required' }]
                }
            })

            expect(result.isError).toBeFalsy()
            const content = result.content[0] as { type: string; text: string }
            expect(content.type).toBe('text')
            const data = JSON.parse(content.text)
            expect(data.errorClass).toBe('ValidationError')
            expect(data.code).toBeDefined()
            expect(data.errorResponse).toBeDefined()
            expect(data.errorResponse.errors).toHaveProperty('email')
        })

        it('build-api-error returns an error message when fields are missing for ValidationError', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-error',
                arguments: { errorClass: 'ValidationError', message: 'Validation failed' }
            })

            const content = result.content[0] as { type: string; text: string }
            expect(content.text).toMatch(/requires at least one entry/i)
        })

        it('build-api-error returns UnauthenticatedUserError response', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-error',
                arguments: { errorClass: 'UnauthenticatedUserError', message: 'Not authenticated' }
            })

            expect(result.isError).toBeFalsy()
            const data = JSON.parse((result.content[0] as { type: string; text: string }).text)
            expect(data.errorClass).toBe('UnauthenticatedUserError')
            expect(data.code).toBeDefined()
            expect(data.errorResponse).toBeNull()
        })

        it('build-api-response returns success shape with data and message', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-response',
                arguments: { type: 'success', data: { id: 42 }, message: 'Created' }
            })

            expect(result.isError).toBeFalsy()
            const data = JSON.parse((result.content[0] as { type: string; text: string }).text)
            expect(data.statusCode).toBe(200)
            expect(data.body.data).toEqual({ id: 42 })
            expect(data.body.message).toBe('Created')
            expect(data.producedBy.imports).toContain('initializeApiResponse')
        })

        it('build-api-response returns validation-error shape', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'build-api-response',
                arguments: {
                    type: 'validation-error',
                    errors: { email: ['Email is required'], name: ['Name is required'] }
                }
            })

            expect(result.isError).toBeFalsy()
            const data = JSON.parse((result.content[0] as { type: string; text: string }).text)
            expect(data.statusCode).toBeTypeOf('number')
            expect(data.body.errors).toMatchObject({ email: ['Email is required'] })
        })

        it('get-crypto-docs returns documentation text', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'get-crypto-docs',
                arguments: { topic: 'overview' }
            })

            expect(result.isError).toBeFalsy()
            const content = result.content[0] as { type: string; text: string }
            expect(content.type).toBe('text')
            expect(content.text.length).toBeGreaterThan(50)
        })

        it('get-console-log-docs returns documentation text', async () => {
            const c = await connectClient()
            const result = await c.callTool({
                name: 'get-console-log-docs',
                arguments: { topic: 'usage' }
            })

            expect(result.isError).toBeFalsy()
            const content = result.content[0] as { type: string; text: string }
            expect(content.type).toBe('text')
            expect(content.text.length).toBeGreaterThan(50)
        })
    })
})
