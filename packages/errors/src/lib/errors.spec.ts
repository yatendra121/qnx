import { ApiError, ValidationError, InvalidValueError, UnauthenticatedUserError, ServerError } from './'
import { setErrorCodes } from './codes'
import type { ErrorResponse } from './types'

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
        expect(apiError).toBeInstanceOf(Error)
        expect(apiError.getCode()).toBe(errorCode)
        expect(apiError.getErrorResponse()).toEqual(errorResponse)
        expect(apiError.message).toBe(errorMessage)
    })

    it('should have undefined errorResponse when no option is provided', () => {
        const apiError = new ApiError('error', 400)
        expect(apiError.getErrorResponse()).toBeUndefined()
    })
})

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
        expect(validationError).toBeInstanceOf(Error)
        expect(validationError.getCode()).toBe(400)
        expect(validationError.getErrorResponse()).toEqual(errorResponse)
        expect(validationError.message).toBe(errorMessage)
    })
})

describe('InvalidValueError', () => {
    it('should have correct error code and auto-built error response', () => {
        const invalidValueError = new InvalidValueError('Username is invalid.', { key: 'username' })

        expect(invalidValueError).toBeInstanceOf(InvalidValueError)
        expect(invalidValueError).toBeInstanceOf(ValidationError)
        expect(invalidValueError).toBeInstanceOf(ApiError)
        expect(invalidValueError).toBeInstanceOf(Error)
        expect(invalidValueError.getCode()).toBe(400)
        expect(invalidValueError.message).toBe('Username is invalid.')
        expect(invalidValueError.getErrorResponse()).toEqual({
            errors: { username: ['Username is invalid.'] }
        })
    })
})

describe('UnauthenticatedUserError', () => {
    it('should have correct error code and response', () => {
        const unauthenticatedUserError = new UnauthenticatedUserError('Unauthenticated user error')

        expect(unauthenticatedUserError).toBeInstanceOf(UnauthenticatedUserError)
        expect(unauthenticatedUserError).toBeInstanceOf(ApiError)
        expect(unauthenticatedUserError).toBeInstanceOf(Error)
        expect(unauthenticatedUserError.getCode()).toBe(401)
        expect(unauthenticatedUserError.getErrorResponse()).toBeUndefined()
        expect(unauthenticatedUserError.message).toBe('Unauthenticated user error')
    })
})

describe('ServerError', () => {
    it('should have correct error code and response', () => {
        const serverError = new ServerError('Server error')

        expect(serverError).toBeInstanceOf(ServerError)
        expect(serverError).toBeInstanceOf(ApiError)
        expect(serverError).toBeInstanceOf(Error)
        expect(serverError.getCode()).toBe(500)
        expect(serverError.getErrorResponse()).toBeUndefined()
        expect(serverError.message).toBe('Server error')
    })
})

describe('Testing with change Codes', () => {
    beforeAll(() => {
        setErrorCodes({
            VALIDATION_ERROR_CODE: 200,
            UNAUTHENTICATED_USER_ERROR_CODE: 200,
            SERVER_ERROR_CODE: 200
        })
    })

    afterAll(() => {
        setErrorCodes({
            VALIDATION_ERROR_CODE: 400,
            UNAUTHENTICATED_USER_ERROR_CODE: 401,
            SERVER_ERROR_CODE: 500
        })
    })

    it('ValidationError should use updated code', () => {
        const validationError = new ValidationError('Validation error', {
            errRes: { errors: { field1: ['Error message 1'] } }
        })
        expect(validationError.getCode()).toBe(200)
    })

    it('InvalidValueError should use updated code', () => {
        const invalidValueError = new InvalidValueError('Invalid.', { key: 'field' })
        expect(invalidValueError.getCode()).toBe(200)
    })

    it('UnauthenticatedUserError should use updated code', () => {
        const unauthenticatedUserError = new UnauthenticatedUserError('Unauthenticated user error')
        expect(unauthenticatedUserError.getCode()).toBe(200)
    })

    it('ServerError should use updated code', () => {
        const serverError = new ServerError('Server error')
        expect(serverError.getCode()).toBe(200)
    })
})
