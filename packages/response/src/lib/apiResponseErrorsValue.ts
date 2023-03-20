import { ApiResponseErrors, ErrorResponse } from '@qnx/interfaces'

/**
 * This class useful for collect & set errors for api response errors
 */
export class ApiResponseErrorsValue {
    private errors: ApiResponseErrors | undefined
    //Get new instance
    static getInstance(): ApiResponseErrorsValue {
        return new ApiResponseErrorsValue()
    }

    /**
     * Set error
     * @param errorKey
     * @param errorMessage
     * @returns
     */
    setError(errorKey: string, errorMessage: string) {
        this.errors = { [errorKey]: [errorMessage] }
        return this
    }

    /**
     * Apend new error
     * @param errorKey
     * @param errorMessage
     * @returns
     */
    addError(errorKey: string, errorMessage: string) {
        this.errors = { ...this.errors, ...{ [errorKey]: [errorMessage] } }
        return this
    }

    /**
     * Return error response for api response
     * @returns
     */
    getErrorResponse(): ErrorResponse {
        return { errors: this.errors }
    }

    /**
     * Return errors for api response
     * @returns
     */
    getErrors() {
        return this.errors
    }
}
