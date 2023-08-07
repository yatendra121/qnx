import { it, expect, describe } from 'vitest'
import { ValidationError, UnauthenticatedUserError, ServerError, ApiError } from './' // Replace with the actual file path
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
        const apiError = new ApiError(errorMessage, errorCode, errorResponse)

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
        const validationError = new ValidationError(errorMessage, errorResponse)

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
        const UnauthenticatedUserError = new UnauthenticatedUserError(errorMessage)

        expect(UnauthenticatedUserError).toBeInstanceOf(UnauthenticatedUserError)
        expect(UnauthenticatedUserError).toBeInstanceOf(ApiError)
        expect(UnauthenticatedUserError.getCode()).toBe(401)
        expect(UnauthenticatedUserError.getErrorResponse()).toBeUndefined()
        expect(UnauthenticatedUserError.message).toBe(errorMessage)
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
