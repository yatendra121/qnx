import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Strips ANSI color/style escape codes so the plain text can be asserted. */
const stripAnsi = (value: string) => value.replace(/\[[0-9;]*m/g, '')

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
    const lastPlain = () => stripAnsi(lastRaw())

    it('returns undefined', () => {
        expect(consoleLog('testing 1')).toBeUndefined()
        expect(consoleLog('testing 2', { type: 'info' })).toBeUndefined()
    })

    it.each([
        { type: 'info', icon: 'ℹ', label: 'info', color: '[36m' },
        { type: 'success', icon: '✔', label: 'success', color: '[32m' },
        { type: 'warning', icon: '⚠', label: 'warning', color: '[33m' },
        { type: 'error', icon: '✖', label: 'error', color: '[31m' }
    ] as const)('renders $type with its icon, label and color', ({ type, icon, label, color }) => {
        consoleLog('the message', { type })

        const plain = lastPlain()
        expect(plain).toContain(icon)
        expect(plain).toContain(label)
        expect(plain).toContain('the message')

        // The accent color wraps both the icon and the label.
        expect(lastRaw()).toContain(color)
    })

    it('defaults to the info style when no options are given', () => {
        consoleLog('no options')

        expect(lastPlain()).toContain('info')
        expect(lastRaw()).toContain('[36m')
    })

    it('falls back to the info style for an empty options object', () => {
        expect(() => consoleLog('empty options', {})).not.toThrow()
        expect(lastPlain()).toContain('info')
    })

    it('falls back to the info style for an unknown type', () => {
        // Untyped JS callers can pass a type outside the Type union.
        expect(() => consoleLog('bad type', { type: 'debug' as never })).not.toThrow()
        expect(lastPlain()).toContain('info')
    })

    it('pads labels so messages stay aligned across types', () => {
        consoleLog('msg', { type: 'info' })
        const infoIndex = lastPlain().indexOf('msg')

        consoleLog('msg', { type: 'success' })
        const successIndex = lastPlain().indexOf('msg')

        expect(infoIndex).toBe(successIndex)
    })
})
