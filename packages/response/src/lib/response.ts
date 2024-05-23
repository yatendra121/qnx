import { errorCodes } from '@qnx/errors'
import { ValidationError, UnauthenticatedUserError } from '@qnx/errors'
import { ApiResponse } from './apiResponse'
import { invalidApiResponse } from './errorResponse'
import { ZodError } from 'zod'
import type { Response as ExResponse } from 'express'

type CallbackObj = { logger?: { serverError: (error: Error) => void | undefined } }
export const callbackObj: CallbackObj = {
    logger: undefined
}

/**
 * Sets a callback object with optional logger for server errors.
 *
 * @param logger - An optional logger object with a serverError method.
 */
export const setCallback = ({ logger }: Partial<CallbackObj>) => {
    if (logger) callbackObj.logger = logger
}

/**
 * Handles errors and sends an appropriate API response.
 * This function should be used in a catch block to handle and respond to various types of errors.
 *
 * @param response - The Express response object to send the response with.
 * @param error - The error to handle, which can be a ValidationError, UnauthenticatedUserError, or generic Error.
 * @returns The API response appropriate for the given error type.
 */
export function errorApiResponse(
    response: ExResponse,
    error: ValidationError | UnauthenticatedUserError | Error
) {
    if (error instanceof ValidationError) {
        return invalidApiResponse(response, error.getErrorResponse()?.errors)
    } else if (error instanceof UnauthenticatedUserError) {
        return unauthenticateApiResponse(response)
    } else if (error.name === 'ZodError' && error instanceof ZodError) {
        return invalidApiResponse(response, collectErrorsFromZodError(error))
    } else {
        setTimeout(() => {
            callbackObj.logger?.serverError(error)
        }, 100)
        return serverErrorApiResponse(response, error)
    }
}

/**
 * Sends an unauthenticated API response.
 *
 * @param response - The Express response object to send the response with.
 * @returns The API response indicating the user is unauthenticated.
 */
export function unauthenticateApiResponse(response: ExResponse) {
    return ApiResponse.getInstance()
        .setMessage('Unauthenticated')
        .setErrorCode('unauthenticated')
        .setStatusCode(errorCodes.UNAUTHENTICATED_USER_ERROR_CODE)
        .response(response)
}

/**
 * Sends a server error API response.
 * This function is useful for handling server errors and sending a consistent error response.
 *
 * @param response - The Express response object to send the response with.
 * @param error - The error that occurred on the server.
 * @returns The API response indicating a server error.
 */
export function serverErrorApiResponse(response: ExResponse, error: unknown) {
    return ApiResponse.getInstance()
        .setServerError(error)
        .setStatusCode(errorCodes.SERVER_ERROR_CODE)
        .response(response)
}

/**
 * Collects and formats errors from a ZodError.
 *
 * @param error - The ZodError to collect errors from.
 * @returns A record of errors formatted for an API response.
 */
const collectErrorsFromZodError = (error: ZodError) => {
    return error.issues.reduce(
        (errors, item) => {
            const path = item.path.join('.')

            // Check if errors[path] exists, if not, initialize it as an array
            if (!errors[path]) {
                errors[path] = []
            }

            errors[path].push(item.message)
            return errors
        },
        {} as Record<string, string[]>
    )
}
