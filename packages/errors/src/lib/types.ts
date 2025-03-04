/**
 * Type definition for API response errors.
 * It is a record where the key is a string and the value is an array of strings.
 */
export type ApiResponseErrors = Record<string, string[]>

/**
 * Interface representing the structure of an error response.
 */
export interface ErrorResponse {
    errors?: ApiResponseErrors
}
