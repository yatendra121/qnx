/**
 * Interface representing the structure of error codes.
 */
export interface ErrorCodes {
    VALIDATION_ERROR_CODE: number
    UNAUTHENTICATED_USER_ERROR_CODE: number
    SERVER_ERROR_CODE: number
}

/**
 * Constant object implementing the ErrorCodes interface,
 * defining the standard error codes used throughout the application.
 */
export const errorCodes: ErrorCodes = {
    VALIDATION_ERROR_CODE: 400,
    UNAUTHENTICATED_USER_ERROR_CODE: 401,
    SERVER_ERROR_CODE: 500
}

/**
 * Updates the existing errorCodes object with new values.
 * Only provided properties in the Partial<ErrorCodes> object are updated.
 *
 * @param obj - Partial object containing new error codes.
 */
export const setErrorCodes = (obj: Partial<ErrorCodes>) => {
    if (obj.VALIDATION_ERROR_CODE !== undefined) {
        errorCodes.VALIDATION_ERROR_CODE = obj.VALIDATION_ERROR_CODE
    }
    if (obj.UNAUTHENTICATED_USER_ERROR_CODE !== undefined) {
        errorCodes.UNAUTHENTICATED_USER_ERROR_CODE = obj.UNAUTHENTICATED_USER_ERROR_CODE
    }
    if (obj.SERVER_ERROR_CODE !== undefined) {
        errorCodes.SERVER_ERROR_CODE = obj.SERVER_ERROR_CODE
    }
}
