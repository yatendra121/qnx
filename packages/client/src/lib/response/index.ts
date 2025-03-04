type ApiErrorCode = string
type ApiErrors = Record<string, string[]>
type ApiMessage = string
type ApiError = string
type ApiServerError = any

/**
 * Interface defining methods to access various properties of an API response.
 *
 * @template T - The type of the response data.
 */
interface ApiResponseInterface<T> {
    getData: () => T | undefined
    getMessage: () => ApiMessage | undefined
    getErrorCode(): ApiErrorCode | undefined
    getErrors(): ApiErrors | undefined
    getError(): ApiError | undefined
}

/**
 * Represents the structure of the value returned by the API.
 *
 * @template T - The type of the response data.
 */
export interface ApiResponseValue<T = any> {
    readonly data?: T
    readonly errorCode?: ApiErrorCode
    readonly error?: ApiError
    readonly errors?: ApiErrors
    readonly message?: ApiMessage
    readonly serverError?: any
}

/**
 * Class to collect and provide data from an API response.
 *
 * @template T - The type of the response data.
 */
class ApiResponse<T = any> implements ApiResponseInterface<T> {
    constructor(private readonly response: ApiResponseValue<T> = {}) {}

    /**
     * Gets the error code from the response.
     *
     * @returns The error code, if present.
     */
    getErrorCode(): ApiErrorCode | undefined {
        return this.response.errorCode
    }

    /**
     * Gets the errors from the response.
     *
     * @returns An object containing the errors, if present.
     */
    getErrors(): ApiErrors | undefined {
        return this.response.errors
    }

    /**
     * Gets the error message from the response.
     *
     * @returns The error message, if present.
     */
    getError(): ApiError | undefined {
        return this.response.error
    }

    /**
     * Gets the message from the response.
     *
     * @returns The message, if present.
     */
    getMessage(): ApiMessage | undefined {
        return this.response.message
    }

    /**
     * Gets the data from the response.
     *
     * @returns The data, if present.
     */
    getData(): T | undefined {
        return this.response.data
    }
}

/**
 * Interface defining methods to access properties of a successful API response.
 *
 * @template T - The type of the response data.
 */
interface ApiSuccessResponseInterface<T> {
    getData: () => T
    getMessage: () => ApiMessage
}

/**
 * Represents the structure of a successful API response value.
 * It includes the response data and a message.
 *
 * @template T - The type of the response data.
 */
export type ApiSuccessResponseValue<T> = Pick<Required<ApiResponseValue<T>>, 'data' | 'message'>

/**
 * Class to collect and provide data from a successful API response.
 *
 * @template T - The type of the response data.
 */
class ApiSuccessResponse<T> implements ApiSuccessResponseInterface<T> {
    constructor(private readonly response: ApiSuccessResponseValue<T>) {}

    /**
     * Gets the data from the response.
     *
     * @returns The response data.
     */
    getData(): T {
        return this.response.data
    }

    /**
     * Gets the message from the response.
     *
     * @returns The response message.
     */
    getMessage(): ApiMessage {
        return this.response.message
    }
}

/**
 * Interface defining methods to access properties of an error API response.
 */
interface ApiErrorResponseInterface {
    getError: () => string
    getErrors: () => Record<string, string[]> | undefined
    getErrorCode: () => string | undefined
}

/**
 * Represents the structure of an error API response value.
 * It includes error details such as error message and error codes.
 */
export type ApiErrorResponseValue = Pick<Required<ApiResponseValue<unknown>>, 'errors' | 'error'> &
    Pick<ApiResponseValue<unknown>, 'errorCode'>

/**
 * Class to collect and provide data from an error API response.
 */
class ApiErrorResponse implements ApiErrorResponseInterface {
    constructor(private readonly response: ApiErrorResponseValue) {}

    /**
     * Gets the error message from the response.
     *
     * @returns The error message.
     */
    getError() {
        return this.response.error
    }

    /**
     * Gets the errors from the response.
     *
     * @returns An object containing the errors, if present.
     */
    getErrors() {
        return this.response.errors
    }

    /**
     * Gets the error code from the response.
     *
     * @returns The error code, if present.
     */
    getErrorCode() {
        return this.response.errorCode
    }
}

export { ApiResponse, ApiSuccessResponse, ApiErrorResponse }
