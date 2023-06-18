import { ApiResponse } from './apiResponse'
import { ApiResponseErrorsValue } from './apiResponseErrorsValue'
import { ApiResponseErrors, ValidationError, errorCodes } from '@qnx/errors'
import type { Response } from 'express'

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
