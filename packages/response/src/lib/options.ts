/**
 * Called with an unexpected error, after its 500 response has been sent. What it returns is not
 * awaited, and if it throws or rejects, that error is ignored.
 */
export type ServerErrorHandler = (error: Error) => unknown

/** Options for every response this package sends. Change them with `setResponseOptions`. */
export interface ResponseOptions {
    /**
     * Whether a server error's name, message and stack are sent to the client as `serverError`.
     * Defaults to `true`, as in earlier versions. Set it to `false` in production so unexpected
     * errors can't leak details such as connection strings or file paths.
     */
    exposeServerError?: boolean
    /**
     * Called for errors that aren't from @qnx/errors or zod, for example to log them. Pass `null`
     * to remove it. When set, it is called instead of the logger from `setCallback`.
     */
    onServerError?: ServerErrorHandler | null
}

/** The current options. Internal: index.ts doesn't export it. */
export const responseOptions: {
    exposeServerError: boolean
    onServerError: ServerErrorHandler | null
} = {
    exposeServerError: true,
    onServerError: null
}

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
    if (options.onServerError !== undefined) {
        responseOptions.onServerError = options.onServerError
    }
}
