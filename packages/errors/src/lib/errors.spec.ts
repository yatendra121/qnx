import { ValidationError, UnauthenticatedUserError, ServerError, ApiError } from './' // Replace with the actual file path
import { setErrorCodes } from './codes'
import type { ErrorResponse } from './types'

// Test cases for ApiError
describe('ApiError', () => {
    it('should have correct error code and response', () => {
        const errorMessage = 'API error'
        const errorCode = 400
        const errorResponse: ErrorResponse = {
            errors: {
                field1: ['Error message 1'],
                field2: ['Error message 2']
            }
        }
        const apiError = new ApiError(errorMessage, errorCode, { errRes: errorResponse })

        expect(apiError).toBeInstanceOf(ApiError)
        expect(apiError.getCode()).toBe(errorCode)
        expect(apiError.getErrorResponse()).toEqual(errorResponse)
        expect(apiError.message).toBe(errorMessage)
    })
})

// Test cases for ValidationError
describe('ValidationError', () => {
    it('should have correct error code and response', () => {
        const errorMessage = 'Validation error'
        const errorResponse: ErrorResponse = {
            errors: {
                field1: ['Error message 1'],
                field2: ['Error message 2']
            }
        }
        const validationError = new ValidationError(errorMessage, { errRes: errorResponse })

        expect(validationError).toBeInstanceOf(ValidationError)
        expect(validationError).toBeInstanceOf(ApiError)
        expect(validationError.getCode()).toBe(400)
        expect(validationError.getErrorResponse()).toEqual(errorResponse)
        expect(validationError.message).toBe(errorMessage)
    })
})

// Test cases for UnauthenticatedUserError
describe('UnauthenticatedUserError', () => {
    it('should have correct error code and response', () => {
        const errorMessage = 'Unauthenticated user error'
        const unauthenticatedUserError = new UnauthenticatedUserError(errorMessage)

        expect(unauthenticatedUserError).toBeInstanceOf(UnauthenticatedUserError)
        expect(unauthenticatedUserError).toBeInstanceOf(ApiError)
        expect(unauthenticatedUserError.getCode()).toBe(401)
        expect(unauthenticatedUserError.getErrorResponse()).toBeUndefined()
        expect(unauthenticatedUserError.message).toBe(errorMessage)
    })
})

// it cases for ServerError
describe('ServerError', () => {
    it('should have correct error code and response', () => {
        const errorMessage = 'Server error'
        const serverError = new ServerError(errorMessage)

        expect(serverError).toBeInstanceOf(ServerError)
        expect(serverError).toBeInstanceOf(ApiError)
        expect(serverError.getCode()).toBe(500)
        expect(serverError.getErrorResponse()).toBeUndefined()
        expect(serverError.message).toBe(errorMessage)
    })
})

describe('Testing with change Codes', () => {
    it('Change codes', async function () {
        setErrorCodes({
            UNAUTHENTICATED_USER_ERROR_CODE: 200,
            SERVER_ERROR_CODE: 200,
            VALIDATION_ERROR_CODE: 200
        })
    })

    it('ValidationError Code', () => {
        const errorMessage = 'Validation error'
        const errorResponse: ErrorResponse = {
            errors: {
                field1: ['Error message 1'],
                field2: ['Error message 2']
            }
        }
        const validationError = new ValidationError(errorMessage, { errRes: errorResponse })

        expect(validationError.getCode()).toBe(200)
    })

    it('UnauthenticatedUserError Code', () => {
        const errorMessage = 'Unauthenticated user error'
        const unauthenticatedUserError = new UnauthenticatedUserError(errorMessage)
        expect(unauthenticatedUserError.getCode()).toBe(200)
    })

    it('ServerError Code', () => {
        const errorMessage = 'Server error'
        const serverError = new ServerError(errorMessage)
        expect(serverError.getCode()).toBe(200)
    })
})
