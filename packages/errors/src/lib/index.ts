export const VALIDATION_ERROR_CODE = 400
export const UNAUTHENTICATE_USER_ERROR_CODE = 401
export const SERVER_ERROR_CODE = 500

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
        super(m, VALIDATION_ERROR_CODE, errRes)
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

/**
 * Unauthenticate user error class
 */
export class UnauthenticateUserError extends ApiError {
    constructor(m: string) {
        super(m, UNAUTHENTICATE_USER_ERROR_CODE)
        Object.setPrototypeOf(this, UnauthenticateUserError.prototype)
    }
}

/**
 * Server error class
 */
export class ServerError extends ApiError {
    constructor(m: string) {
        super(m, SERVER_ERROR_CODE)
        Object.setPrototypeOf(this, ServerError.prototype)
    }
}
