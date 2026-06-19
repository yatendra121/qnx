import { consoleLog } from './log'

describe('log', () => {
    it('should work', () => {
        expect(consoleLog('testing 1')).toEqual(undefined)
        expect(consoleLog('testing 2', { type: 'info' })).toEqual(undefined)
    })

    it('should not throw when options is an empty object', () => {
        expect(() => consoleLog('testing 3', {})).not.toThrow()
    })

    it('should not throw for an unknown type and fall back to info', () => {
        // Untyped JS callers can pass a type outside the Type union.
        expect(() => consoleLog('testing 4', { type: 'debug' as never })).not.toThrow()
    })

    it('should accept each supported type', () => {
        for (const type of ['info', 'error', 'success', 'warning'] as const) {
            expect(() => consoleLog('testing 5', { type })).not.toThrow()
        }
    })
})
