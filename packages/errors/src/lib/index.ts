import { errorCodes } from './codes'
export * from './codes'
export type ApiResponseErrors = Record<string, string[]>
export interface ErrorResponse {
    errors?: ApiResponseErrors
}

/**
 * Used for create custom error instance
 */
class ApiError extends Error {
    errorCode: number
    errorResponse: ErrorResponse | undefined
    constructor(m: string, code: number, errRes?: ErrorResponse) {
        super(m)
        Object.setPrototypeOf(this, ApiError.prototype)
        this.errorCode = code
        this.errorResponse = errRes
    }

    getCode() {
        return this.errorCode
    }

    getErrorResponse() {
        return this.errorResponse
    }
}

/**
 * Validation error class
 */
export class ValidationError extends ApiError {
    constructor(m: string, errRes: ErrorResponse) {
        super(m, errorCodes.VALIDATION_ERROR_CODE, errRes)
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

/**
 * Unauthenticate user error class
 */
export class UnauthenticateUserError extends ApiError {
    constructor(m: string) {
        super(m, errorCodes.UNAUTHENTICATED_USER_ERROR_CODE)
        Object.setPrototypeOf(this, UnauthenticateUserError.prototype)
    }
}

/**
 * Server error class
 */
export class ServerError extends ApiError {
    constructor(m: string) {
        super(m, errorCodes.SERVER_ERROR_CODE)
        Object.setPrototypeOf(this, ServerError.prototype)
    }
}
