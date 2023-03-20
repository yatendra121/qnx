import { ServerError } from './index'

describe('apiHelpersErrors', () => {
    it('should work', () => {
        expect(new ServerError('test')).toEqual('api-helpers-errors')
    })
})
