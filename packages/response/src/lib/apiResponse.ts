import type { Response as ExResponse } from 'express'
import type { ApiResponseErrors } from '@qnx/errors'

const SHOW_SERVER_ERROR = true

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setData(data: any) {
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
     * Sets a server error for the response. The server error will only be included if SHOW_SERVER_ERROR is true.
     *
     * @param error - The server error to be included in the response.
     * @returns The current ApiResponse instance.
     */
    setServerError(error: unknown) {
        if (!SHOW_SERVER_ERROR) return this
        const err = error as Error
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
     *
     * @param response - The Express response object to send the response with.
     * @returns The response sent by the Express response object.
     */
    response(response: ExResponse) {
        if (this.errors) this.error = this.errors[Object.keys(this.errors)?.[0]]?.[0]
        return response.status(this.#statusCode).send({ ...this.#additionalData, ...this })
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
