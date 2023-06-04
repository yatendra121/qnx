import { errorCodes } from '@qnx/errors'
import { ApiResponseErrors, ValidationError, UnauthenticateUserError } from '@qnx/errors'
import { ApiResponse } from './apiResponse'
import { Response } from 'express'
import type { Logger } from 'winston'

let logger: Logger | undefined = undefined
export function setLoggerInstance(instance: Logger) {
    logger = instance
}

/**
 * Return unauthenticate api response
 * @param response
 * @returns
 */
export function unauthenticateApiResponse(response: Response) {
    return ApiResponse.getInstance()
        .setMessage('Unauthenticated')
        .setErrorCode('unauthenticated')
        .response(response, errorCodes.UNAUTHENTICATED_USER_ERROR_CODE)
}

/**
 * This is useful when you want collect all errors into a single try catch block
 * If you using this function in catch block then you don't need define additional try catch block
 * for api response
 * @param response
 * @param error
 * @returns
 */
export function errorApiResponse(
    response: Response,
    error: ValidationError | UnauthenticateUserError | Error
) {
    if (error instanceof ValidationError) {
        return invalidApiResponse(response, error.getErrorResponse()?.errors)
    } else if (error instanceof UnauthenticateUserError) {
        return unauthenticateApiResponse(response)
    } else if (error instanceof Error && error.name === 'ZodError') {
        return invalidApiResponse(response, collectErrorsFromZodError(error))
    } else {
        setTimeout(() => {
            logger?.error('API Handler:', error)
        }, 100)
        return serverErrorApiResponse(response, error)
    }
}

/**
 * This is useful to collect any errors that will be consider as server error
 * @param response
 * @param error
 * @returns
 */
export function serverErrorApiResponse(response: Response, error: unknown) {
    return ApiResponse.getInstance()
        .setServerError(error)
        .response(response, errorCodes.SERVER_ERROR_CODE)
}

/**
 * To send validation api response and can send multiple validation errors
 * @param response
 * @param errors
 * @returns
 */
export function invalidApiResponse(response: Response, errors: ApiResponseErrors | undefined) {
    const apiRes = ApiResponse.getInstance()
    if (errors) apiRes.setErrors(errors)
    return apiRes.response(response, errorCodes.VALIDATION_ERROR_CODE)
}

/**
 * To send validation api response and that is useful when you want single validation error
 * @param response
 * @param errorKey
 * @param errorMessage
 * @returns
 */
export function invalidValueApiResponse(
    response: Response,
    errorKey: string,
    errorMessage: string
) {
    return invalidApiResponse(response, { [errorKey]: [errorMessage] })
}

const collectErrorsFromZodError = (error: any) => {
    const test = error.format()
    return removeErrorKeyFromZodError(test)
}

const removeErrorKeyFromZodError = (error: any) => {
    for (const key in error) {
        if (Object.prototype.hasOwnProperty.call(error, key)) {
            if (Array.isArray(error[key]) && !error[key].length) delete error[key]
            else error[key] = error[key]._errors
        }
    }

    return error
}
