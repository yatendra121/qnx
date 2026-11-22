import type { Response as ExResponse } from 'express'
import type { ApiResponseErrors } from '@qnx/errors'

/** Options for every response this package sends. Change them with `setResponseOptions`. */
export interface ResponseOptions {
    /**
     * Whether a server error's name, message and stack are sent to the client as `serverError`.
     * Defaults to `true`, as in earlier versions. Set it to `false` in production so unexpected
     * errors can't leak details such as connection strings or file paths.
     */
    exposeServerError?: boolean
}

const responseOptions: Required<ResponseOptions> = { exposeServerError: true }

/**
 * Changes the options for every response this package sends. Call it once at startup.
 * Only the options you pass are changed.
 *
 * @param options - The options to change.
 */
export function setResponseOptions(options: ResponseOptions) {
    if (options.exposeServerError !== undefined) {
        responseOptions.exposeServerError = options.exposeServerError
    }
}

/**
 * Class for sending API responses.
 *
 * @template T - The type of the data included in the response.
 */
export class ApiResponse<T = unknown> {
    #statusCode = 200
    #additionalData = {}

    protected data?: T
    protected errorCode?: string
    protected errors?: ApiResponseErrors
    protected error?: string
    protected message?: string
    protected serverError?: unknown

    /**
     * Returns a new instance of ApiResponse.
     *
     * @returns A new ApiResponse instance.
     */
    static getInstance(): ApiResponse {
        return new ApiResponse()
    }

    /**
     * Sets the data for the response.
     *
     * @param data - The data to be included in the response.
     * @returns The current ApiResponse instance.
     */
    setData(data: T) {
        this.data = data
        return this
    }

    /**
     * Sets the error code for the response.
     *
     * @param errorCode - The error code to be included in the response.
     * @returns The current ApiResponse instance.
     */
    setErrorCode(errorCode: string) {
        this.errorCode = errorCode
        return this
    }

    /**
     * Sets a single error message for the response.
     *
     * @param error - The error message to be included in the response.
     * @returns The current ApiResponse instance.
     */
    setError(error: string) {
        this.error = error
        return this
    }

    /**
     * Sets multiple errors for the response.
     *
     * @param errors - An object containing multiple error messages.
     * @returns The current ApiResponse instance.
     */
    setErrors(errors: ApiResponseErrors) {
        this.errors = errors
        return this
    }

    /**
     * Sets a message for the response.
     *
     * @param message - The message to be included in the response.
     * @returns The current ApiResponse instance.
     */
    setMessage(message: string) {
        this.message = message
        return this
    }

    /**
     * Sets the status code for the response.
     *
     * @param statusCode - The HTTP status code to be used for the response.
     * @returns The current ApiResponse instance.
     */
    setStatusCode(statusCode: number) {
        this.#statusCode = statusCode
        return this
    }

    /**
     * Sets a server error for the response. When `exposeServerError` has been turned off with
     * `setResponseOptions`, the error is left out and the message is "Internal Server Error",
     * unless a message has already been set.
     *
     * @param error - The server error to be included in the response.
     * @returns The current ApiResponse instance.
     */
    setServerError(error: unknown) {
        if (!responseOptions.exposeServerError) {
            this.message ??= 'Internal Server Error'
            return this
        }
        // Anything can be thrown or rejected, including primitives, null and undefined.
        const isObject = typeof error === 'object' && error !== null
        const err = (isObject ? error : { message: String(error) }) as Partial<Error>
        this.serverError = {
            name: err.name,
            message: err.message,
            stack: err.stack
        }
        return this
    }

    /**
     * Sets additional data to be included in the response.
     *
     * @param data - An object containing additional data.
     * @returns The current ApiResponse instance.
     */
    setAdditional(data: { [key: string]: unknown }) {
        this.#additionalData = data
        return this
    }

    /**
     * Sends the API response using the provided Express response object.
     * If a response has already been sent (e.g. a direct `*ApiResponse` call without `return`),
     * this is a no-op instead of raising ERR_HTTP_HEADERS_SENT.
     *
     * @param response - The Express response object to send the response with.
     * @returns The response sent by the Express response object.
     */
    response(response: ExResponse) {
        if (response.headersSent) return response
        if (this.errors) this.error = this.errors[Object.keys(this.errors)?.[0]]?.[0]
        // Class fields exist on the instance even when unset, so skip undefined values to keep them from overriding additional data.
        const fields = Object.entries(this).filter(([, value]) => value !== undefined)
        return response
            .status(this.#statusCode)
            .send({ ...this.#additionalData, ...Object.fromEntries(fields) })
    }
}

/**
 * Initializes and returns a new instance of ApiResponse.
 *
 * @returns A new instance of the ApiResponse class.
 */
export function initializeApiResponse() {
    return ApiResponse.getInstance()
}
