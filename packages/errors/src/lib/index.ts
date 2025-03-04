import { errorCodes } from './codes'
import type { ErrorResponse } from './types'

/**
 * Used for create custom error instance
 */
export class ApiError extends Error {
    errorCode: number
    errorResponse: ErrorResponse | undefined

    /**
     * Constructs a new ApiError instance.
     *
     * @param m - The error message.
     * @param code - The error code.
     * @param option - Optional parameter containing an error response object.
     */
    constructor(m: string, code: number, option?: { errRes?: ErrorResponse }) {
        super(m)
        Object.setPrototypeOf(this, ApiError.prototype)
        this.errorCode = code
        this.errorResponse = option?.errRes
    }

    /**
     * Returns the error code of the error.
     *
     * @returns The error code.
     */
    getCode() {
        return this.errorCode
    }

    /**
     * Returns the error response object if available.
     *
     * @returns The error response object.
     */
    getErrorResponse() {
        return this.errorResponse
    }
}

/**
 * Custom error class for handling validation errors.
 * Extends ApiError.
 */
export class ValidationError extends ApiError {
    /**
     * Constructs a new ValidationError instance.
     *
     * @param m - The error message.
     * @param option - Parameter containing an error response object.
     */
    constructor(m: string, option: { errRes: ErrorResponse }) {
        super(m, errorCodes.VALIDATION_ERROR_CODE, option)
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

/**
 * Custom error class for handling invalid value errors.
 * Extends ValidationError.
 */
export class InvalidValueError extends ValidationError {
    /**
     * Constructs a new InvalidValueError instance.
     *
     * @param m - The error message.
     * @param key - The key associated with the invalid value.
     */
    constructor(m: string, { key }: { key: string }) {
        super(m, { errRes: { errors: { [key]: [m] } } })
        Object.setPrototypeOf(this, InvalidValueError.prototype)
    }
}

/**
 * Custom error class for handling unauthenticated user errors.
 * Extends ApiError.
 */
export class UnauthenticatedUserError extends ApiError {
    /**
     * Constructs a new UnauthenticatedUserError instance.
     *
     * @param m - The error message.
     */
    constructor(m: string) {
        super(m, errorCodes.UNAUTHENTICATED_USER_ERROR_CODE)
        Object.setPrototypeOf(this, UnauthenticatedUserError.prototype)
    }
}

/**
 * Custom error class for handling server errors.
 * Extends ApiError.
 */
export class ServerError extends ApiError {
    /**
     * Constructs a new ServerError instance.
     *
     * @param m - The error message.
     */
    constructor(m: string) {
        super(m, errorCodes.SERVER_ERROR_CODE)
        Object.setPrototypeOf(this, ServerError.prototype)
    }
}
