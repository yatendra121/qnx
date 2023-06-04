import { ApiResponseErrorsValue } from './apiResponseErrorsValue'
import { ValidationError } from '@qnx/errors'

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
