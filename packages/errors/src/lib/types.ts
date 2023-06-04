export type ApiResponseErrors = Record<string, string[]>
export interface ErrorResponse {
    errors?: ApiResponseErrors
}
