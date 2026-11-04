import { ApiResponseErrorsValue as ErrorsApiResponseErrorsValue } from '@qnx/errors'
import { ApiResponseErrorsValue } from '../../index'
import { describe, test, expect } from 'vitest'

describe('ApiResponseErrorsValue', () => {
    test('behaves the same as the class in @qnx/errors', () => {
        const build = (Value: typeof ApiResponseErrorsValue | typeof ErrorsApiResponseErrorsValue) => {
            const value = Value.getInstance()
            const empty = value.hasErrors()
            value.addError('email', 'first').addError('email', 'second').addError('name', 'third')
            const added = value.getErrors()
            const response = value.getErrorResponse()
            value.setError('email', 'replaced')
            return { empty, added, response, set: value.getErrors(), has: value.hasErrors() }
        }

        expect(build(ApiResponseErrorsValue)).toEqual(build(ErrorsApiResponseErrorsValue))
    })

    test('has the same methods as the class in @qnx/errors', () => {
        const methods = (value: object) => Object.getOwnPropertyNames(value).sort()

        expect(methods(ApiResponseErrorsValue.prototype)).toEqual(
            methods(ErrorsApiResponseErrorsValue.prototype)
        )
    })
})
