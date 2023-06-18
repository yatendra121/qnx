import { ApiResponseErrorsValue } from '../apiResponseErrorsValue'
import { describe, test, expect, beforeEach } from 'vitest'
describe('ApiResponseErrorsValue', () => {
    let apiResponseErrorsValue: ApiResponseErrorsValue

    beforeEach(() => {
        apiResponseErrorsValue = ApiResponseErrorsValue.getInstance()
    })

    test('setError should set an error', () => {
        const errorKey = 'key'
        const errorMessage = 'Error message'
        apiResponseErrorsValue.setError(errorKey, errorMessage)

        const errors = apiResponseErrorsValue.getErrors()
        expect(errors).toEqual({ [errorKey]: [errorMessage] })
    })

    test('addError should append a new error', () => {
        const errorKey = 'key1'
        const errorMessage = 'Error message 1'
        apiResponseErrorsValue.setError(errorKey, errorMessage)

        const newErrorKey = 'key2'
        const newErrorMessage = 'Error message 2'
        apiResponseErrorsValue.addError(newErrorKey, newErrorMessage)

        const errors = apiResponseErrorsValue.getErrors()
        expect(errors).toEqual({
            [errorKey]: [errorMessage],
            [newErrorKey]: [newErrorMessage]
        })
    })

    test('getErrorResponse should return the error response', () => {
        const errorKey = 'key'
        const errorMessage = 'Error message'
        apiResponseErrorsValue.setError(errorKey, errorMessage)

        const errorResponse = apiResponseErrorsValue.getErrorResponse()
        expect(errorResponse).toEqual({ errors: { [errorKey]: [errorMessage] } })
    })

    test('getErrors should return the errors', () => {
        const errorKey = 'key'
        const errorMessage = 'Error message'
        apiResponseErrorsValue.setError(errorKey, errorMessage)

        const errors = apiResponseErrorsValue.getErrors()
        expect(errors).toEqual({ [errorKey]: [errorMessage] })
    })
})
