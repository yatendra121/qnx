import type { RequestHandler, Response } from 'express'
import { describe, expectTypeOf, it } from 'vitest'
import {
    ApiResponse,
    asyncValidatorHandler,
    errorApiResponse,
    initializeApiResponse,
    invalidApiResponse,
    serverErrorApiResponse,
    setCallback,
    setResponseOptions
} from '../../index'
import type { ResponseOptions, ServerErrorHandler } from '../../index'

// Type-checked by vitest (typecheck in vite.config.ts) on every test run.
describe('public types', () => {
    it('accepts any caught value in errorApiResponse', () => {
        expectTypeOf(errorApiResponse).parameter(1).toEqualTypeOf<unknown>()
        expectTypeOf(errorApiResponse).parameter(0).toEqualTypeOf<Response>()
        expectTypeOf(serverErrorApiResponse).parameter(1).toEqualTypeOf<unknown>()
    })

    it('types setData by the class parameter', () => {
        expectTypeOf(initializeApiResponse().setData).parameter(0).toEqualTypeOf<unknown>()
        expectTypeOf(new ApiResponse<{ id: number }>().setData({ id: 1 })).toEqualTypeOf<
            ApiResponse<{ id: number }>
        >()
        // @ts-expect-error the data must match the type parameter
        new ApiResponse<{ id: number }>().setData('not an object')
    })

    it('returns an Express request handler', () => {
        expectTypeOf(asyncValidatorHandler(async () => 1)).toExtend<RequestHandler>()
    })

    it('keeps the configuration functions', () => {
        expectTypeOf(setResponseOptions).parameter(0).toEqualTypeOf<ResponseOptions>()
        expectTypeOf<ResponseOptions>().toEqualTypeOf<{
            exposeServerError?: boolean
            onServerError?: ServerErrorHandler | null
        }>()
        expectTypeOf<ServerErrorHandler>().toEqualTypeOf<(error: Error) => unknown>()
        // A logger method that returns something, such as winston's, still fits.
        const winstonLike = { error: (message: string, error: Error) => (void [message, error], winstonLike) }
        setResponseOptions({ onServerError: (error) => winstonLike.error('API Handler:', error) })
        setResponseOptions({ onServerError: async () => undefined })
        // @ts-expect-error the callback receives an Error, not a string
        setResponseOptions({ onServerError: (error: string) => void error })
        expectTypeOf(setCallback)
            .parameter(0)
            .toExtend<{ logger?: { serverError: (error: Error) => unknown } }>()
        expectTypeOf(invalidApiResponse).parameter(2).toEqualTypeOf<number | undefined>()
    })
})
