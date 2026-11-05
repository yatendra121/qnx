import type { ApiResponseErrors, ErrorResponse } from '@qnx/errors'

/**
 * Class for collecting and setting errors for API response errors.
 *
 * This is a copy of the class in `@qnx/errors`, not a re-export, because `@qnx/errors` only has
 * it from 0.8.15. A re-export would make importing this package fail with any older version,
 * which the peer range allows and pnpm and yarn only warn about. Remove it in the next major.
 *
 * @deprecated Import `ApiResponseErrorsValue` from `@qnx/errors` instead.
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
        const existing = this.errors?.[errorKey] ?? []
        this.errors = { ...this.errors, [errorKey]: [...existing, errorMessage] }
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

    /**
     * Checks whether any errors have been collected.
     *
     * @returns True if at least one error has been set, otherwise false.
     */
    hasErrors(): boolean {
        return !!this.errors && Object.keys(this.errors).length > 0
    }
}
