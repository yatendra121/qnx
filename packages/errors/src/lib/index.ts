import { errorCodes } from './codes'
import type { ErrorResponse } from './types'

/**
 * Used for create custom error instance
 */
export class ApiError extends Error {
    errorCode: number
    errorResponse: ErrorResponse | undefined
    constructor(m: string, code: number, option?: { errRes?: ErrorResponse }) {
        super(m)
        Object.setPrototypeOf(this, ApiError.prototype)
        this.errorCode = code
        this.errorResponse = option?.errRes
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
    constructor(m: string, option: { errRes: ErrorResponse }) {
        super(m, errorCodes.VALIDATION_ERROR_CODE, option)
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

/**
 * Invalid value error class
 */
export class InvalidValueError extends ValidationError {
    constructor(m: string, { key }: { key: string }) {
        super(m, { errRes: { errors: { [key]: [m] } } })
        Object.setPrototypeOf(this, InvalidValueError.prototype)
    }
}

/**
 * Unauthenticate user error class
 */
export class UnauthenticatedUserError extends ApiError {
    constructor(m: string) {
        super(m, errorCodes.UNAUTHENTICATED_USER_ERROR_CODE)
        Object.setPrototypeOf(this, UnauthenticatedUserError.prototype)
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
