import { vitest } from 'vitest'
import {
    ValidationError,
    UnauthenticateUserError,
    ServerError,
    ApiResponseErrors,
    ErrorResponse
} from './' // Replace with the actual file path

const { test, expect, describe } = vitest()

// Test cases for ApiError
describe('ApiError', () => {
    test('should have correct error code and response', () => {
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
    test('should have correct error code and response', () => {
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

// Test cases for UnauthenticateUserError
describe('UnauthenticateUserError', () => {
    test('should have correct error code and response', () => {
        const errorMessage = 'Unauthenticated user error'
        const unauthenticateUserError = new UnauthenticateUserError(errorMessage)

        expect(unauthenticateUserError).toBeInstanceOf(UnauthenticateUserError)
        expect(unauthenticateUserError).toBeInstanceOf(ApiError)
        expect(unauthenticateUserError.getCode()).toBe(401)
        expect(unauthenticateUserError.getErrorResponse()).toBeUndefined()
        expect(unauthenticateUserError.message).toBe(errorMessage)
    })
})

// Test cases for ServerError
describe('ServerError', () => {
    test('should have correct error code and response', () => {
        const errorMessage = 'Server error'
        const serverError = new ServerError(errorMessage)

        expect(serverError).toBeInstanceOf(ServerError)
        expect(serverError).toBeInstanceOf(ApiError)
        expect(serverError.getCode()).toBe(500)
        expect(serverError.getErrorResponse()).toBeUndefined()
        expect(serverError.message).toBe(errorMessage)
    })
})

// Run the tests
test.run()
