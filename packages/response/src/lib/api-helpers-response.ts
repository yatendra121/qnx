import {
    SERVER_ERROR_CODE,
    UnauthenticateUserError,
    UNAUTHENTICATE_USER_ERROR_CODE,
    ValidationError,
    VALIDATION_ERROR_CODE
} from '@qnx/errors'
import { ApiResponse } from './apiResponse'
import { Response } from '@qnx/interfaces'
import { ApiResponseErrors } from '@qnx/interfaces'
import { ApiResponseErrorsValue } from './api-response-errors-value'

/**
 * Return unauthenticate api response
 * @param response
 * @returns
 */
export function unauthenticateApiResponse(response: Response) {
    return ApiResponse.getInstance()
        .setMessage('Unauthenticated')
        .setErrorCode('unauthenticated')
        .response(response, UNAUTHENTICATE_USER_ERROR_CODE)
}

/**
 * This is useful when you want collect all errors into a single try catch block
 * If you using this function in catch block then you don't need define additional try catch block
 * for api response
 * @param response
 * @param error
 * @returns
 */
export function errorApiResponse(response: Response, error: unknown) {
    if (error instanceof ValidationError) {
        return invalidApiResponse(response, error.getErrorResponse()?.errors)
    } else if (error instanceof UnauthenticateUserError) {
        return unauthenticateApiResponse(response)
    }
    return serverErrorApiResponse(response, error)
}

/**
 * This is useful to collect any errors that will be consider as server error
 * @param response
 * @param error
 * @returns
 */
export function serverErrorApiResponse(response: Response, error: unknown) {
    return ApiResponse.getInstance().setServerError(error).response(response, SERVER_ERROR_CODE)
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
    return apiRes.response(response, VALIDATION_ERROR_CODE)
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

/**
 * To send validation api response and that is useful when you want single validation error
 * @param errorKey
 * @param errorMessage
 * @returns
 */
export function throwInvalidValueApiResponse(errorKey: string, errorMessage: string): never {
    const errorResponse = new ApiResponseErrorsValue()
        .setError(errorKey, errorMessage)
        .getErrorResponse()
    throw new ValidationError('Error', errorResponse)
}
