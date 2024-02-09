import { errorCodes } from '@qnx/errors'
import { ValidationError, UnauthenticatedUserError } from '@qnx/errors'
import { ApiResponse } from './apiResponse'
import { Response } from 'express'
import { invalidApiResponse } from './errorResponse'

type CallbackObj = { logger?: { serverError: (error: Error) => void | undefined } }
export const callbackObj: CallbackObj = {
    logger: undefined
}

export const setCallback = ({ logger }: Partial<CallbackObj>) => {
    if (logger) callbackObj.logger = logger
}

/**
 * Using for internal uses
 * This is useful when you want collect all errors into a single try catch block
 * If you using this function in catch block then you don't need define additional try catch block
 * for api response
 * @param response
 * @param error
 * @returns
 */
export function errorApiResponse(
    response: Response,
    error: ValidationError | UnauthenticatedUserError | Error
) {
    if (error instanceof ValidationError) {
        return invalidApiResponse(response, error.getErrorResponse()?.errors)
    } else if (error instanceof UnauthenticatedUserError) {
        return unauthenticateApiResponse(response)
    } else if (error instanceof Error && error.name === 'ZodError') {
        return invalidApiResponse(response, collectErrorsFromZodError(error))
    } else {
        setTimeout(() => {
            callbackObj.logger?.serverError(error)
        }, 100)
        return serverErrorApiResponse(response, error)
    }
}

/**
 * Using for internal uses
 * Return unauthenticate api response
 * @param response
 * @returns
 */
export function unauthenticateApiResponse(response: Response) {
    return ApiResponse.getInstance()
        .setMessage('Unauthenticated')
        .setErrorCode('unauthenticated')
        .setStatusCode(errorCodes.UNAUTHENTICATED_USER_ERROR_CODE)
        .response(response)
}

/**
 * Using for internal uses
 * This is useful to collect any errors that will be consider as server error
 * @param response
 * @param error
 * @returns
 */
export function serverErrorApiResponse(response: Response, error: unknown) {
    return ApiResponse.getInstance()
        .setServerError(error)
        .setStatusCode(errorCodes.SERVER_ERROR_CODE)
        .response(response)
}

/**
 * Using for internal uses
 * @param error
 * @returns
 */
const collectErrorsFromZodError = (error: any) => {
    const test = error.format()
    return removeErrorKeyFromZodError(test)
}

/**
 * Using for internal uses
 * @param error
 * @returns
 */
const removeErrorKeyFromZodError = (error: any) => {
    for (const key in error) {
        if (Object.prototype.hasOwnProperty.call(error, key)) {
            if (Array.isArray(error[key]) && !error[key].length) delete error[key]
            else error[key] = error[key]._errors
        }
    }

    return error
}
