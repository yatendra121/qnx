import { consoleLog } from './log'

describe('log', () => {
    it('should work', () => {
        expect(consoleLog('testing 1')).toEqual(undefined)
        expect(consoleLog('testing 2', { type: 'info' })).toEqual(undefined)
    })
})
