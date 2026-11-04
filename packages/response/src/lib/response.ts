import { errorCodes } from '@qnx/errors'
import { ApiError, ValidationError, UnauthenticatedUserError } from '@qnx/errors'
import { ApiResponse } from './apiResponse'
import { invalidApiResponse } from './errorResponse'
import type { $ZodError } from 'zod/v4/core'
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
        return invalidApiResponse(response, error.getErrorResponse()?.errors, error.getCode())
    } else if (error instanceof UnauthenticatedUserError) {
        return unauthenticateApiResponse(response)
    } else if (isZodError(error)) {
        return invalidApiResponse(response, collectErrorsFromZodError(error))
    } else if (error instanceof ApiError) {
        const apiRes = ApiResponse.getInstance().setMessage(error.message)
        const errors = error.getErrorResponse()?.errors
        if (errors) apiRes.setErrors(errors)
        return apiRes.setStatusCode(error.getCode()).response(response)
    } else {
        // Loggers are typed to receive an Error and run outside this try/catch, so a thrown
        // primitive or null must not reach one that reads `error.stack` and crash the process.
        const loggable =
            typeof error === 'object' && error !== null ? error : new Error(String(error))
        queueMicrotask(() => {
            callbackObj.logger?.serverError(loggable)
        })
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
 * Detects a ZodError by shape rather than `instanceof`, so errors thrown by a different
 * zod module instance (e.g. zod v3, or a duplicated install) are still treated as
 * validation errors instead of falling through to a 500 server error.
 * zod classic and v3 name the error 'ZodError'; zod-mini throws the core '$ZodError'.
 *
 * @param error - The error to check.
 * @returns True if the error looks like a ZodError.
 */
const isZodError = (error: unknown): error is $ZodError => {
    // Anything can be thrown or rejected, including null and undefined (`Promise.reject()`).
    const candidate = error as Partial<$ZodError> | null | undefined
    return (
        (candidate?.name === 'ZodError' || candidate?.name === '$ZodError') &&
        Array.isArray(candidate.issues)
    )
}

/**
 * Collects and formats errors from a ZodError.
 *
 * @param error - The ZodError to collect errors from.
 * @returns A record of errors formatted for an API response.
 */
const collectErrorsFromZodError = (error: $ZodError) => {
    // Paths can come from request data (e.g. z.record keys), so a key such as "constructor"
    // or "__proto__" must not resolve to something inherited from Object.prototype.
    const collected = new Map<string, string[]>()
    for (const { path, message } of error.issues) {
        // zod types path segments as PropertyKey, and join() throws on a symbol.
        const key = path.map(String).join('.')
        collected.set(key, [...(collected.get(key) ?? []), message])
    }
    return Object.fromEntries(collected)
}
