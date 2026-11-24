import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@qnx/errors'
import { asyncValidatorHandler } from '../handler'
import { ApiResponse, setResponseOptions } from '../apiResponse'
import { errorApiResponse, serverErrorApiResponse, setCallback } from '../response'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function fakeRes() {
    const sent: { status?: number; body?: Record<string, unknown> } = {}
    const res = {
        headersSent: false,
        status(code: number) {
            sent.status = code
            return res
        },
        send(body: Record<string, unknown>) {
            sent.body = JSON.parse(JSON.stringify(body))
            res.headersSent = true
            return res
        }
    }
    return { res: res as unknown as Response, sent }
}

describe('server error logger', () => {
    const escaped = vi.fn()
    beforeEach(() => {
        escaped.mockClear()
        process.on('uncaughtException', escaped)
        process.on('unhandledRejection', escaped)
    })
    afterEach(() => {
        process.off('uncaughtException', escaped)
        process.off('unhandledRejection', escaped)
        setCallback({ logger: { serverError: () => undefined } })
    })

    it('does not crash the process when the logger throws', async () => {
        const serverError = vi.fn(() => {
            throw new Error('logger down')
        })
        setCallback({ logger: { serverError } })
        const { res, sent } = fakeRes()

        errorApiResponse(res, new Error('boom'))
        await sleep(0)

        expect(serverError).toHaveBeenCalledTimes(1)
        expect(escaped).not.toHaveBeenCalled()
        expect(sent.status).toBe(500)
    })

    it('does not cause an unhandled rejection when an async logger rejects', async () => {
        const serverError = vi.fn(async () => {
            throw new Error('async logger down')
        })
        setCallback({ logger: { serverError } })

        errorApiResponse(fakeRes().res, new Error('boom'))
        await sleep(0)

        expect(serverError).toHaveBeenCalledTimes(1)
        expect(escaped).not.toHaveBeenCalled()
    })

    it('still runs after the response has been sent', async () => {
        const order: string[] = []
        setCallback({ logger: { serverError: () => void order.push('logged') } })
        const { res } = fakeRes()
        const send = res.send.bind(res)
        res.send = ((body: unknown) => {
            order.push('sent')
            return send(body)
        }) as Response['send']

        errorApiResponse(res, new Error('boom'))
        order.push('returned')
        await sleep(0)

        expect(order).toEqual(['sent', 'returned', 'logged'])
    })
})

describe('setResponseOptions', () => {
    afterEach(() => setResponseOptions({ exposeServerError: true }))

    it('sends name, message and stack by default', () => {
        const { res, sent } = fakeRes()

        errorApiResponse(res, new TypeError('secret detail'))

        expect(sent.body?.serverError).toMatchObject({
            name: 'TypeError',
            message: 'secret detail'
        })
    })

    it('leaves the server error out when exposeServerError is false', () => {
        setResponseOptions({ exposeServerError: false })
        const { res, sent } = fakeRes()

        errorApiResponse(res, new TypeError('secret detail'))

        expect(sent).toEqual({ status: 500, body: { message: 'Internal Server Error' } })
        expect(JSON.stringify(sent.body)).not.toContain('secret detail')
    })

    it('applies to serverErrorApiResponse too, and keeps a message that was set', () => {
        setResponseOptions({ exposeServerError: false })
        const direct = fakeRes()
        const built = fakeRes()

        serverErrorApiResponse(direct.res, new Error('secret'))
        ApiResponse.getInstance()
            .setMessage('Try again later')
            .setServerError(new Error('secret'))
            .response(built.res)

        expect(direct.sent.body).toEqual({ message: 'Internal Server Error' })
        expect(built.sent.body).toEqual({ message: 'Try again later' })
    })

    it('changes only the options that are passed', () => {
        setResponseOptions({ exposeServerError: false })
        setResponseOptions({})
        const { res, sent } = fakeRes()

        errorApiResponse(res, new Error('x'))

        expect(sent.body?.serverError).toBeUndefined()
    })

    it('does not affect errors from @qnx/errors', () => {
        setResponseOptions({ exposeServerError: false })
        const { res, sent } = fakeRes()

        errorApiResponse(res, new ApiError('Already exists', 409))

        expect(sent).toEqual({ status: 409, body: { message: 'Already exists' } })
    })
})

describe('asyncValidatorHandler when the error response cannot be sent', () => {
    it('passes the failure to next() instead of rejecting (Express 4 would crash)', async () => {
        const next = vi.fn()
        // Express 4 doesn't validate the status, Node's writeHead throws later. Either way it throws.
        const res = {
            headersSent: false,
            status: () => {
                throw new RangeError('Invalid status code: 1001')
            }
        } as unknown as Response
        const handler = asyncValidatorHandler(async () => {
            throw new ApiError('Custom code', 1001)
        })

        await expect(handler({} as Request, res, next)).resolves.toBeUndefined()

        expect(next).toHaveBeenCalledTimes(1)
        expect(next.mock.calls[0][0]).toBeInstanceOf(RangeError)
    })

    it('reaches the app error handler in Express 5, as before', async () => {
        const app = express()
        app.get(
            '/',
            asyncValidatorHandler(async () => {
                throw new ApiError('Custom code', 1001)
            })
        )
        // Express treats middleware as an error handler only when it declares four parameters.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
            res.status(500).json({ handled: err.name })
        })

        const response = await request(app).get('/')

        expect(response.status).toBe(500)
        expect(response.body).toEqual({ handled: 'RangeError' })
    })

    it('does not call next() again if the function already did', async () => {
        const next = vi.fn()
        const res = {
            headersSent: false,
            status: () => {
                throw new RangeError('Invalid status code')
            }
        } as unknown as Response
        const handler = asyncValidatorHandler(async (_req, _res, innerNext) => {
            innerNext()
            throw new ApiError('Custom code', 1001)
        })

        await handler({} as Request, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(next.mock.calls[0][0]).toBeUndefined()
    })
})
