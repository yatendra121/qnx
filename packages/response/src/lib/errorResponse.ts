import { ApiResponse } from './apiResponse'
import { ApiResponseErrorsValue } from './apiResponseErrorsValue'
import { ApiResponseErrors, ValidationError, errorCodes } from '@qnx/errors'
import type { Response as ExResponse } from 'express'

/**
 * Sends a validation API response with multiple validation errors.
 *
 * @param response - The Express response object to send the response with.
 * @param errors - An object containing multiple validation errors.
 * @returns The API response with a validation error code and errors.
 */
export function invalidApiResponse(response: ExResponse, errors: ApiResponseErrors | undefined) {
    const apiRes = ApiResponse.getInstance()
    if (errors) apiRes.setErrors(errors)
    return apiRes.setStatusCode(errorCodes.VALIDATION_ERROR_CODE).response(response)
}

/**
 * Sends a validation API response with a single validation error.
 *
 * @param response - The Express response object to send the response with.
 * @param errorKey - The key associated with the validation error.
 * @param errorMessage - The validation error message to be sent.
 * @returns The API response with a validation error code and a single error.
 */
export function invalidValueApiResponse(
    response: ExResponse,
    errorKey: string,
    errorMessage: string
) {
    return invalidApiResponse(response, { [errorKey]: [errorMessage] })
}

/**
 * Throws a ValidationError with a single validation error.
 *
 * @param errorKey - The key associated with the validation error.
 * @param errorMessage - The validation error message.
 * @throws ValidationError - Throws a validation error with the provided error details.
 */
export function throwInvalidValueApiResponse(errorKey: string, errorMessage: string): never {
    const errorResponse = new ApiResponseErrorsValue()
        .setError(errorKey, errorMessage)
        .getErrorResponse()
    throw new ValidationError('Error', { errRes: errorResponse })
}
