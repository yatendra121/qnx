import { consoleLog } from './log'

describe('log', () => {
    it('should work', () => {
        expect(consoleLog({ message: 'testing', type: 'info' })).toEqual(undefined)
    })
})
