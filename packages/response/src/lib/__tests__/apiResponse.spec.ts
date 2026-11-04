import type { Response as ExResponse } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponse } from '../apiResponse'

function sendBody(apiResponse: ApiResponse) {
    const send = vi.fn()
    const res = { headersSent: false, status: () => ({ send }) } as unknown as ExResponse
    apiResponse.response(res)
    return send.mock.calls[0][0]
}

describe('ApiResponse', () => {
    it('keeps additional data when the same field is unset', () => {
        const body = sendBody(
            ApiResponse.getInstance().setAdditional({
                data: { foo: 'additional' },
                message: 'hi',
                test: 'ok'
            })
        )

        expect(body).toEqual({ data: { foo: 'additional' }, message: 'hi', test: 'ok' })
    })

    it('prefers its own fields over additional data', () => {
        const body = sendBody(
            ApiResponse.getInstance()
                .setData({ foo: 'bar' })
                .setAdditional({ data: { foo: 'additional' }, test: 'ok' })
        )

        expect(body).toEqual({ data: { foo: 'bar' }, test: 'ok' })
    })

    it('omits unset fields from the body', () => {
        expect(Object.keys(sendBody(ApiResponse.getInstance().setData(1)))).toEqual(['data'])
    })
})
