import type { ApiResponseErrors, ErrorResponse } from '@qnx/errors'

/**
 * Class for collecting and setting errors for API response errors.
 */
export class ApiResponseErrorsValue {
    private errors: ApiResponseErrors | undefined

    /**
     * Returns a new instance of ApiResponseErrorsValue.
     *
     * @returns A new ApiResponseErrorsValue instance.
     */
    static getInstance(): ApiResponseErrorsValue {
        return new ApiResponseErrorsValue()
    }

    /**
     * Sets an error message for a specific error key.
     *
     * @param errorKey - The key associated with the error.
     * @param errorMessage - The error message to be associated with the key.
     * @returns The current ApiResponseErrorsValue instance.
     */
    setError(errorKey: string, errorMessage: string) {
        this.errors = { [errorKey]: [errorMessage] }
        return this
    }

    /**
     * Appends a new error message for a specific error key.
     *
     * @param errorKey - The key associated with the new error.
     * @param errorMessage - The new error message to be added.
     * @returns The current ApiResponseErrorsValue instance.
     */
    addError(errorKey: string, errorMessage: string) {
        this.errors = { ...this.errors, ...{ [errorKey]: [errorMessage] } }
        return this
    }

    /**
     * Returns the error response for the API.
     *
     * @returns An object containing the errors for the API response.
     */
    getErrorResponse(): ErrorResponse {
        return { errors: this.errors }
    }

    /**
     * Returns the collected errors.
     *
     * @returns An object containing the errors.
     */
    getErrors() {
        return this.errors
    }
}
