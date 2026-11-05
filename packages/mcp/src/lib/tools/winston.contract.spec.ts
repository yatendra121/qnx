import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '@qnx/winston'
import { callTool } from './__tests__/contract-helpers'

// Importing the logger creates ./logs, so move out of the repo first. This runs before the imports above.
await vi.hoisted(async () => {
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    process.chdir(mkdtempSync(join(tmpdir(), 'qnx-winston-')))
})

describe('@qnx/winston previews match the real file output (B2, B10)', () => {
    const readEntries = (): Record<string, unknown>[] => {
        const file = readdirSync('logs').find((name) => name.endsWith('.log'))
        if (!file) return []
        // The logger writes in the background, so the file can be empty or end mid-line. Only finished lines count.
        const lines = readFileSync(join('logs', file), 'utf8').split('\n').slice(0, -1)
        return lines.map((line) => JSON.parse(line))
    }

    const written = async (run: () => void, predicate: (entry: Record<string, unknown>) => boolean) => {
        run()
        for (let attempt = 0; attempt < 100; attempt++) {
            const found = readEntries().find(predicate)
            if (found) return found
            await new Promise((done) => setTimeout(done, 20))
        }
        return undefined
    }

    const withoutTime = (entry: Record<string, unknown>) => {
        const rest = { ...entry }
        delete rest.timestamp
        delete rest.stack
        return rest
    }

    it.each([
        ['info', 'plain message', undefined],
        ['warn', 'with metadata', { userId: 1, zeta: { b: 1, a: 2 } }],
        ['http', 'http line', { url: '/x' }],
        ['debug', 'debug line', undefined],
        ['info', 'metadata message', { message: 'appended' }]
    ] as const)('%s: %s', async (level, message, metadata) => {
        const preview = (await callTool('build-file-log-entry', { level, message, ...(metadata && { metadata }) })).json()
        const real = await written(
            () => logger[level](message, metadata ?? {}),
            (entry) => String(entry.message).startsWith(message)
        )
        expect(preview.written).toBe(true)
        expect(withoutTime(preview.fileEntry)).toEqual(withoutTime(real as Record<string, unknown>))
        expect(Object.keys(preview.fileEntry)).toEqual(Object.keys(real as object))
    })

    it('previews logging an Error the way it is written', async () => {
        const preview = (await callTool('build-file-log-entry', { level: 'error', message: 'contract-err', errorMessage: 'db down' })).json()
        const real = await written(() => logger.error('contract-err', new Error('db down')), (entry) => String(entry.message).startsWith('contract-err')) as Record<string, string>
        expect(withoutTime(preview.fileEntry)).toEqual(withoutTime(real))
        expect(real.stack).toContain('Error: db down')
        expect(preview.fileEntry.stack).toContain('Error: db down')
        expect(preview.snippet).toContain(`logger.error('contract-err', err)`)
    })

    it('previews metadata alongside an Error the way the documented call writes it', async () => {
        const preview = (await callTool('build-file-log-entry', { level: 'error', message: 'contract-meta', metadata: { orderId: 7 }, errorMessage: 'declined' })).json()
        const err = new Error('declined')
        const real = await written(() => logger.error('contract-meta', { orderId: 7, errorMessage: err.message, stack: err.stack }), (entry) => entry.message === 'contract-meta') as Record<string, string>
        expect(withoutTime(preview.fileEntry)).toEqual(withoutTime(real))
        expect(real.stack).toContain('Error: declined')
    })

    it('the documented failure modes are real, and the tool warns about them', async () => {
        const nested = await written(() => logger.error('contract-nested', { error: new Error('lost') }), (entry) => entry.message === 'contract-nested') as Record<string, unknown>
        expect(nested.error).toEqual({})
        expect(nested.stack).toBeUndefined()

        const preview = (await callTool('build-file-log-entry', { level: 'error', message: 'x', metadata: { error: 'value' } })).json()
        expect(preview.notes.join()).toContain('written as {}')
        expect(preview.fileEntry.stack).toBeUndefined()
        expect(JSON.stringify(preview)).not.toContain('your-file.ts')

        const docs = (await callTool('get-file-logger-docs', { topic: 'all' })).text
        expect(docs).toContain(`logger.error('Payment failed', err)`)
        expect(docs.replace(/\| ❌[^\n]*\n/g, '')).not.toMatch(/\{ error(: err)? \}/)
    })

    it('silly is never written, and the preview says so', async () => {
        const marker = 'contract-silly'
        logger.silly(marker)
        logger.info('contract-after-silly')
        await written(() => undefined, (entry) => entry.message === 'contract-after-silly')
        expect(readEntries().some((entry) => entry.message === marker)).toBe(false)

        const preview = (await callTool('build-file-log-entry', { level: 'silly', message: marker })).json()
        expect(preview).toMatchObject({ written: false, fileEntry: null })
        expect(preview.notes.join()).toContain('writes nothing')
    })

    it('importing the logger created the directory the docs describe', () => {
        expect(existsSync('logs')).toBe(true)
    })
})
