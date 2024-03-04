import { decyptToken, generateToken } from '../crypto'
import { describe, it } from 'vitest'

describe('Crypto Integration Testing', function () {
    it('generate token', async function () {
        const data = await generateToken('string')
        expect(true).toEqual(!!data.dbToken)
        expect(true).toEqual(!!data.token)
    })

    it('generate & decrypt token', async function () {
        const tokenVal = 'this is testing string.'
        const data = await generateToken(tokenVal)
        expect(true).toEqual(!!data.dbToken)
        expect(true).toEqual(!!data.token)

        const values = await decyptToken(data.token)
        expect(tokenVal).toEqual(values.sub)
    })
})
