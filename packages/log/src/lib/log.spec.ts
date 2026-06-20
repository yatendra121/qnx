import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('log', () => {
    let logSpy: ReturnType<typeof vi.spyOn>
    let consoleLog: typeof import('./log').consoleLog

    beforeEach(async () => {
        // The module binds `const log = console.log` at import time, so the spy
        // must exist before it is imported. Reset modules and re-import to be sure.
        vi.resetModules()
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

        // Force chalk to emit basic ANSI colors in the non-TTY test environment.
        const chalk = (await import('chalk')).default
        chalk.level = 1
        ;({ consoleLog } = await import('./log'))
    })

    afterEach(() => {
        logSpy.mockRestore()
        vi.resetModules()
    })

    /** Returns the raw (still styled) string passed to the most recent console.log call. */
    const lastRaw = () => String(logSpy.mock.calls.at(-1)?.[0] ?? '')

    it('returns undefined', () => {
        expect(consoleLog('testing 1')).toBeUndefined()
        expect(consoleLog('testing 2', { type: 'info' })).toBeUndefined()
    })

    it.each([
        { type: 'info', color: '[34m', icon: 'ⓘ' },
        { type: 'success', color: '[32m', icon: '✓' },
        { type: 'warn', color: '[33m', icon: '⚠' },
        { type: 'error', color: '[31m', icon: '✗' },
        { type: 'debug', color: '[35m', icon: '◇' },
        { type: 'trace', color: '[36m', icon: '☆' }
    ] as const)('colors a $type message with its icon and color', ({ type, color, icon }) => {
        consoleLog('the message', { type })

        const raw = lastRaw()
        expect(raw).toContain('the message')
        expect(raw).toContain(icon)
        expect(raw).toContain(color)
    })

    it('defaults to the info color when no options are given', () => {
        consoleLog('no options')
        expect(lastRaw()).toContain('[34m')
    })

    it('falls back to the info color for an empty options object', () => {
        expect(() => consoleLog('empty options', {})).not.toThrow()
        expect(lastRaw()).toContain('[34m')
    })

    it('falls back to the info color for an unknown type', () => {
        // Untyped JS callers can pass a type outside the Type union.
        expect(() => consoleLog('bad type', { type: 'verbose' as never })).not.toThrow()
        expect(lastRaw()).toContain('[34m')
    })
})
