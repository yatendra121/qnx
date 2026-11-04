import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { asyncValidatorHandler } from '../handler'
import { errorApiResponse, setCallback } from '../response'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function jsonApp() {
    const app = express()
    app.use(express.json())
    return app
}

describe('asyncValidatorHandler chain control', () => {
    it('does not advance the chain twice when the function calls next() itself', async () => {
        const order: string[] = []
        const app = jsonApp()
        app.get(
            '/guarded',
            asyncValidatorHandler(async (_req, _res, next) => {
                order.push('wrapped')
                next()
            }),
            async (_req, res) => {
                order.push('auth start')
                await sleep(20)
                order.push('auth deny')
                res.status(403).json({ denied: true })
            },
            (_req, res) => {
                order.push('protected')
                res.json({ secret: true })
            }
        )

        const response = await request(app).get('/guarded')

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ denied: true })
        expect(order).toEqual(['wrapped', 'auth start', 'auth deny'])
    })

    it('ignores repeated next() calls from the function', async () => {
        const later = vi.fn((_req: Request, res: Response) => void res.json({ ok: true }))
        const app = jsonApp()
        app.get(
            '/',
            asyncValidatorHandler(async (_req, _res, next) => {
                next()
                next()
            }),
            later
        )

        expect((await request(app).get('/')).status).toBe(200)
        expect(later).toHaveBeenCalledTimes(1)
    })

    it('forwards an error passed to next()', async () => {
        const app = jsonApp()
        app.get(
            '/',
            asyncValidatorHandler(async (_req, _res, next) => next(new Error('forwarded')))
        )
        app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
            res.status(418).json({ message: err.message })
        })

        const response = await request(app).get('/')

        expect(response.status).toBe(418)
        expect(response.body).toEqual({ message: 'forwarded' })
    })

    it('still continues the chain when the function returns nothing', async () => {
        const app = jsonApp()
        app.get(
            '/',
            asyncValidatorHandler(async () => undefined),
            (_req, res) => void res.json({ reached: true })
        )

        expect((await request(app).get('/')).body).toEqual({ reached: true })
    })

    it('does not run later middleware once the function has responded', async () => {
        const notFound = vi.fn((_req: Request, res: Response) => void res.status(404).json({}))
        const onError = vi.fn((_err: Error, _req: Request, _res: Response, next: NextFunction) =>
            next()
        )
        const app = jsonApp()
        app.get(
            '/',
            asyncValidatorHandler(async (_req, res) => {
                res.json({ sent: true })
            })
        )
        app.use(notFound)
        app.use(onError)

        const response = await request(app).get('/')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ sent: true })
        expect(notFound).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })
})

describe('asyncValidatorHandler with unusual thrown values', () => {
    it.each([
        ['null', () => Promise.reject(null)],
        ['undefined', () => Promise.reject()],
        ['a string', () => Promise.reject('boom')],
        ['a number', () => Promise.reject(42)]
    ])('answers 500 when the function rejects with %s', async (_label, func) => {
        const app = jsonApp()
        app.get('/', asyncValidatorHandler(func))
        // Express 4 ignores the promise a handler returns, so a rejection here would be
        // unhandled there. This middleware proves the handler never rejects into Express.
        const escaped = vi.fn((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
            res.status(599).end()
        })
        app.use(escaped)

        const response = await request(app).get('/')

        expect(escaped).not.toHaveBeenCalled()
        expect(response.status).toBe(500)
        expect(response.body.serverError).toBeDefined()
    })

    it('reports the value of a thrown primitive', async () => {
        const app = jsonApp()
        app.get('/', asyncValidatorHandler(() => Promise.reject('boom')))

        expect((await request(app).get('/')).body.serverError).toEqual({ message: 'boom' })
    })

    it.each([
        ['null', null, 'null'],
        ['undefined', undefined, 'undefined'],
        ['a string', 'boom', 'boom']
    ])('gives the logger an Error when the function rejects with %s', async (_label, value, text) => {
        const serverError = vi.fn()
        setCallback({ logger: { serverError } })
        const app = jsonApp()
        app.get('/', asyncValidatorHandler(() => Promise.reject(value)))

        await request(app).get('/')
        await sleep(0)

        const logged = serverError.mock.calls[0][0]
        expect(logged).toBeInstanceOf(Error)
        expect(logged.message).toBe(text)
    })

    it('gives the logger the original Error object', async () => {
        const serverError = vi.fn()
        setCallback({ logger: { serverError } })
        const error = new TypeError('bad')
        const app = jsonApp()
        app.get('/', asyncValidatorHandler(() => Promise.reject(error)))

        await request(app).get('/')
        await sleep(0)

        expect(serverError.mock.calls[0][0]).toBe(error)
    })

    it('keeps name, message and stack of a real Error', async () => {
        const app = jsonApp()
        app.get('/', asyncValidatorHandler(() => Promise.reject(new TypeError('bad'))))

        const { serverError } = (await request(app).get('/')).body

        expect(serverError).toMatchObject({ name: 'TypeError', message: 'bad' })
        expect(serverError.stack).toContain('TypeError: bad')
    })
})

describe('zod errors keyed by request data', () => {
    const app = jsonApp()
    app.post(
        '/record',
        asyncValidatorHandler(async (req) => z.record(z.string(), z.number()).parse(req.body))
    )

    // JSON.stringify would drop none of these, and each one exists on Object.prototype.
    it.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf'])(
        'answers 400 for the body key "%s"',
        async (key) => {
            const response = await request(app)
                .post('/record')
                .set('Content-Type', 'application/json')
                .send(`{"${key}":"not a number"}`)

            expect(response.status).toBe(400)
            expect(Object.keys(response.body.errors)).toEqual([key])
            expect(response.body.error).toBe(response.body.errors[key][0])
        }
    )

    it('does not pollute the prototype through a "__proto__" path', () => {
        const send = vi.fn()
        const res = { headersSent: false, status: () => ({ send }) } as unknown as Response
        const error = Object.assign(new Error('invalid'), {
            name: 'ZodError',
            issues: [{ path: ['__proto__'], message: 'bad' }]
        })

        errorApiResponse(res, error)

        const body = send.mock.calls[0][0]
        expect(Object.keys(body.errors)).toEqual(['__proto__'])
        expect(({} as Record<string, unknown>)['message']).toBeUndefined()
    })

    it('groups several issues on one path, in order', () => {
        const send = vi.fn()
        const res = { headersSent: false, status: () => ({ send }) } as unknown as Response
        const error = Object.assign(new Error('invalid'), {
            name: 'ZodError',
            issues: [
                { path: ['posts', 0, 'title'], message: 'first' },
                { path: ['posts', 0, 'title'], message: 'second' },
                { path: [], message: 'root' }
            ]
        })

        errorApiResponse(res, error)

        expect(send.mock.calls[0][0].errors).toEqual({
            'posts.0.title': ['first', 'second'],
            '': ['root']
        })
    })

    it('accepts a symbol path segment', () => {
        const send = vi.fn()
        const res = { headersSent: false, status: () => ({ send }) } as unknown as Response
        const error = Object.assign(new Error('invalid'), {
            name: 'ZodError',
            issues: [{ path: [Symbol('key')], message: 'bad' }]
        })

        errorApiResponse(res, error)

        expect(send.mock.calls[0][0].errors).toEqual({ 'Symbol(key)': ['bad'] })
    })
})
