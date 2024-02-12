// Generated by dts-bundle-generator v9.0.0

export type ApiErrorCode = string;
export type ApiErrors = Record<string, string[]>;
export type ApiMessage = string;
export type ApiError = string;
export interface ApiResponseInterface<T> {
	getData: () => T | undefined;
	getMessage: () => ApiMessage | undefined;
	getErrorCode(): ApiErrorCode | undefined;
	getErrors(): ApiErrors | undefined;
	getError(): ApiError | undefined;
}
/**
 * Represents the response value returned by the API.
 *
 * @template T - The type of the response data.
 */
export interface ApiResponseValue<T = any> {
	readonly data?: T;
	readonly errorCode?: ApiErrorCode;
	readonly error?: ApiError;
	readonly errors?: ApiErrors;
	readonly message?: ApiMessage;
	readonly serverError?: any;
}
/**
 * Will use collect data from api response
 */
export declare class ApiResponse<T = any> implements ApiResponseInterface<T> {
	private readonly response;
	constructor(response?: ApiResponseValue<T>);
	getErrorCode(): ApiErrorCode | undefined;
	getErrors(): ApiErrors | undefined;
	getError(): ApiError | undefined;
	getMessage(): ApiMessage | undefined;
	getData(): T | undefined;
}
export interface ApiSuccessResponseInterface<T> {
	getData: () => T;
	getMessage: () => ApiMessage;
}
/**
 * Represents a successful API response value.
 * It includes the response data and a message.
 *
 * @template T - The type of the response data.
 */
export type ApiSuccessResponseValue<T> = Pick<Required<ApiResponseValue<T>>, "data" | "message">;
/**
 * Will use collect data from success api response
 */
export declare class ApiSuccessResponse<T> implements ApiSuccessResponseInterface<T> {
	private readonly response;
	constructor(response: ApiSuccessResponseValue<T>);
	getData(): T;
	getMessage(): ApiMessage;
}
export interface ApiErrorResponseInterface {
	getError: () => string;
	getErrors: () => Record<string, string[]> | undefined;
	getErrorCode: () => string | undefined;
}
/**
 * Represents an error API response value.
 * It includes error details such as error messages and error codes.
 */
export type ApiErrorResponseValue = Pick<Required<ApiResponseValue<unknown>>, "errors" | "error"> & Pick<ApiResponseValue<unknown>, "errorCode">;
/**
 * Will use collect data from error api response
 */
export declare class ApiErrorResponse implements ApiErrorResponseInterface {
	private readonly response;
	constructor(response: ApiErrorResponseValue);
	getError(): string;
	getErrors(): ApiErrors;
	getErrorCode(): string | undefined;
}

export {};
