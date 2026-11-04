import type {
    NextFunction as ExpressNextFunction,
    Request as ExpressRequest,
    Response as ExpressResponse
} from 'express'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Message, NextFunction, Request, Response, User } from '../index'

// The type assertions are enforced by tsc: this file is part of tsconfig.lib.json,
// so the typecheck target and the build fail if one stops holding.
describe('@qnx/interfaces', () => {
    it('adds no runtime code', async () => {
        expect(Object.keys(await import('../index'))).toEqual([])
    })

    it('adds the user to the express request', () => {
        expectTypeOf<Request>().toExtend<ExpressRequest>()
        expectTypeOf<Request['user']>().toEqualTypeOf<User>()
    })

    it('re-exports the express response and next function', () => {
        expectTypeOf<Response>().toEqualTypeOf<ExpressResponse>()
        expectTypeOf<NextFunction>().toEqualTypeOf<ExpressNextFunction>()
    })

    it('describes users and messages', () => {
        expectTypeOf<User>().toEqualTypeOf<{
            id: string
            name: string
            email: string
            password: string
        }>()
        expectTypeOf<Message>().toEqualTypeOf<{ message: string }>()
    })
})
