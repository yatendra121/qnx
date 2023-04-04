import { ApiResponseErrors } from '@qnx/interfaces'
import { Response } from 'express'

const SHOW_SERVER_ERROR = true

/**
 * This class is useful for send api response
 */
export class ApiResponse<T = unknown> {
    protected data?: T
    protected errorCode?: string
    protected errors?: ApiResponseErrors
    protected error?: string
    protected message?: string
    protected serverError?: unknown

    //Get new instance
    static getInstance(): ApiResponse {
        return new ApiResponse()
    }

    /**
     * Set any data for response
     * @param data
     * @returns ApiResponse
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setData(data: any) {
        this.data = data
        return this
    }

    /**
     * Set any error code
     * @param errorCode
     * @returns
     */
    setErrorCode(errorCode: string) {
        this.errorCode = errorCode
        return this
    }

    /**
     * Set any error
     * @param error
     * @returns
     */
    setError(error: string) {
        this.error = error
        return this
    }

    /**
     * Set multiple errors
     * @param errors
     * @returns
     */
    setErrors(errors: ApiResponseErrors) {
        this.errors = errors
        return this
    }

    /**
     * Set any message
     * @param message
     * @returns
     */
    setMessage(message: string) {
        this.message = message
        return this
    }

    /**
     * Set server error
     * @param error
     * @returns
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
     * Return api response
     * @param response
     * @param status
     * @returns
     */
    response(response: Response, status = 200) {
        if (this.errors) this.error = this.errors[Object.keys(this.errors)[0]][0]
        return response.status(status).send({ ...this })
    }
}

/**
 *
 * @returns Instance of ApiResponse class
 */
export function initializeApiResponse() {
    return ApiResponse.getInstance()
}
