export interface ErrorCodes {
    VALIDATION_ERROR_CODE: number
    UNAUTHENTICATED_USER_ERROR_CODE: number
    SERVER_ERROR_CODE: number
}

export const errorCodes: ErrorCodes = {
    VALIDATION_ERROR_CODE: 400,
    UNAUTHENTICATED_USER_ERROR_CODE: 401,
    SERVER_ERROR_CODE: 500
}

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
