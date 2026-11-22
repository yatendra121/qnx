import { describe, expectTypeOf, it } from 'vitest'
import {
    ApiError,
    ApiResponseErrorsValue,
    InvalidValueError,
    ServerError,
    UnauthenticatedUserError,
    ValidationError,
    errorCodes,
    setErrorCodes
} from '../index'
import type { ApiResponseErrors, ErrorCodes, ErrorResponse } from '../index'

// Type-checked by vitest (typecheck in vite.config.ts) on every test run.
describe('public types', () => {
    it('keeps the constructor signatures', () => {
        expectTypeOf(ApiError).constructorParameters.toEqualTypeOf<
            [m: string, code: number, option?: { errRes?: ErrorResponse }]
        >()
        expectTypeOf(ValidationError).constructorParameters.toEqualTypeOf<
            [m: string, option: { errRes: ErrorResponse }]
        >()
        expectTypeOf(InvalidValueError).constructorParameters.toEqualTypeOf<
            [m: string, option: { key: string }]
        >()
        expectTypeOf(UnauthenticatedUserError).constructorParameters.toEqualTypeOf<[m: string]>()
        expectTypeOf(ServerError).constructorParameters.toEqualTypeOf<[m: string]>()

        // @ts-expect-error ValidationError needs errRes
        void (() => new ValidationError('x'))
    })

    it('keeps the hierarchy and accessors', () => {
        expectTypeOf<InvalidValueError>().toExtend<ValidationError>()
        expectTypeOf<ValidationError>().toExtend<ApiError>()
        expectTypeOf<ServerError>().toExtend<ApiError>()
        expectTypeOf<ApiError>().toExtend<Error>()
        expectTypeOf<ApiError['getCode']>().returns.toEqualTypeOf<number>()
        expectTypeOf<ApiError['getErrorResponse']>().returns.toEqualTypeOf<
            ErrorResponse | undefined
        >()
    })

    it('keeps the helper and code types', () => {
        expectTypeOf<ApiResponseErrors>().toEqualTypeOf<Record<string, string[]>>()
        expectTypeOf(
            ApiResponseErrorsValue.getInstance().addError('a', 'b')
        ).toEqualTypeOf<ApiResponseErrorsValue>()
        expectTypeOf<ApiResponseErrorsValue['getErrors']>().returns.toEqualTypeOf<
            ApiResponseErrors | undefined
        >()
        expectTypeOf(errorCodes).toEqualTypeOf<ErrorCodes>()
        expectTypeOf(setErrorCodes).parameter(0).toEqualTypeOf<Partial<ErrorCodes>>()
    })
})
