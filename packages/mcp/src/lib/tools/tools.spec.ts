import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { errorCodes } from '@qnx/errors'
import packageJson from '../../../package.json'
import { createMcpServer } from '../server'

/** Generated snippets and docs must describe what the @qnx/* libraries really do. */
describe('tool output accuracy', () => {
    let client: Client | undefined

    async function call(name: string, args: Record<string, unknown>) {
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
        await createMcpServer().connect(serverTransport)
        client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: {} })
        await client.connect(clientTransport)
        const result = await client.callTool({ name, arguments: args })
        return (result.content as { text: string }[])[0].text
    }

    afterEach(async () => {
        await client?.close()
        client = undefined
    })

    it('reports the package version as the server version', async () => {
        await call('list-mcp-tools', {})
        expect(client?.getServerVersion()?.version).toBe(packageJson.version)
    })

    it('build-console-log previews the real icon and color', async () => {
        const output = JSON.parse(await call('build-console-log', { type: 'info', message: 'hi' }))
        expect(output).toMatchObject({ color: 'blue', consoleOutput: 'ⓘ  hi' })
    })

    it.each(['success', 'warn', 'error', 'debug', 'trace'])(
        'build-console-log accepts the %s type',
        async (type) => {
            const { snippet } = JSON.parse(await call('build-console-log', { type, message: 'hi' }))
            expect(snippet).toContain(`consoleLog('hi', { type: '${type}' })`)
        }
    )

    it('build-console-log turns the deprecated warning type into warn', async () => {
        const { snippet } = JSON.parse(
            await call('build-console-log', { type: 'warning', message: 'hi' })
        )
        expect(snippet).toContain(`{ type: 'warn' }`)
    })

    it.each([
        ['build-console-log', { type: 'info', message: `user's` }, `consoleLog('user\\'s')`],
        ['build-file-log-entry', { level: 'info', message: `user's` }, `logger.info('user\\'s')`],
        [
            'build-crypto-snippet',
            { operation: 'auth-token-generate', subject: `user's` },
            `generateAuthToken('user\\'s')`
        ],
        [
            'build-client-response',
            { responseClass: 'ApiSuccessResponse', data: {}, message: `user's` },
            `message: 'user\\'s'`
        ]
    ])('%s escapes an apostrophe in generated code', async (name, args, expected) => {
        const { snippet } = JSON.parse(await call(name, args))
        expect(snippet).toContain(expected)
    })

    it('get-error-class-docs states the real default validation code', async () => {
        const text = await call('get-error-class-docs', { errorClass: 'all' })
        expect(errorCodes.VALIDATION_ERROR_CODE).toBe(400)
        expect(text).toContain('(default: `400`)')
        expect(text).not.toContain('(default: `422`)')
        expect(text).not.toContain('not exported')
    })

    it('get-console-log-docs lists the types the library accepts', async () => {
        const text = await call('get-console-log-docs', { topic: 'all' })
        for (const type of ['info', 'success', 'warn', 'error', 'debug', 'trace']) {
            expect(text).toContain(`\`${type}\``)
        }
    })
})
