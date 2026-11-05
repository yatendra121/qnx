import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { quote } from './quote'
import { jsonResult, readOnlyTool, toolError } from './shared'

const responseClasses = ['ApiResponse', 'ApiSuccessResponse', 'ApiErrorResponse'] as const

const paramRequirements: Record<typeof responseClasses[number], string> = {
    ApiResponse: 'All fields optional. Provide any combination of data, message, error, errors, errorCode.',
    ApiSuccessResponse: 'Requires: data + message. No error fields.',
    ApiErrorResponse: 'Requires: error + errors. errorCode is optional.'
}

const SUCCESS_CHECK_NOTE = 'These classes only read fields. They can\'t tell success from failure: check response.ok or the status. See get-client-docs { "topic": "handling-responses" }.'

const show = (value: unknown) => (typeof value === 'string' ? quote(value) : JSON.stringify(value) ?? 'undefined')

/** Splits getters by what they return. JSON has no undefined, and showing null would misstate the real return value. */
function describeGetters(getters: Record<string, unknown>) {
    const entries = Object.entries(getters)
    return {
        methods: Object.fromEntries(entries.filter(([, value]) => value !== undefined)),
        returnUndefined: entries.filter(([, value]) => value === undefined).map(([name]) => name),
        comments: entries.map(([name, value]) => `res.${name}() // ${show(value)}`)
    }
}

export function registerBuildClientResponseTool(server: McpServer) {
    server.registerTool(
        'build-client-response',
        {
            ...readOnlyTool('Preview a client response class'),
            description: [
                'Show what each getter of a @qnx/client response class returns for the values you give it.',
                'For how to detect failures in real responses, use get-client-docs with topic handling-responses.',
                '',
                'Required fields per responseClass:',
                '  ApiResponse        → all fields optional (data, message, error, errors, errorCode)',
                '  ApiSuccessResponse → data (required) + message (required)',
                '  ApiErrorResponse   → error (required) + errors (required) + errorCode (optional)'
            ].join('\n'),
            inputSchema: {
                responseClass: z.enum(responseClasses).describe(
                    'ApiResponse | ApiSuccessResponse | ApiErrorResponse'
                ),
                data: z.unknown().optional().describe(
                    'ApiResponse / ApiSuccessResponse — the response payload'
                ),
                message: z.string().optional().describe(
                    'ApiResponse / ApiSuccessResponse — success message'
                ),
                error: z.string().optional().describe(
                    'ApiResponse / ApiErrorResponse — top-level error message'
                ),
                errors: z.record(z.string(), z.array(z.string())).optional().describe(
                    'ApiResponse / ApiErrorResponse — field-level validation errors'
                ),
                errorCode: z.string().optional().describe(
                    'ApiResponse / ApiErrorResponse — machine-readable error code'
                )
            }
        },
        async ({ responseClass, data, message, error, errors, errorCode }) => {
            if (responseClass === 'ApiSuccessResponse') {
                if (data === undefined) {
                    return toolError(`Error: ApiSuccessResponse requires "data". ${paramRequirements.ApiSuccessResponse}`)
                }
                if (!message) {
                    return toolError(`Error: ApiSuccessResponse requires "message". ${paramRequirements.ApiSuccessResponse}`)
                }

                const { methods, returnUndefined, comments } = describeGetters({ getData: data, getMessage: message })
                return jsonResult({
                    responseClass,
                    input: { data, message },
                    methods,
                    returnUndefined,
                    snippet: [
                        `import { ApiSuccessResponse } from '@qnx/client'`,
                        ``,
                        `const res = new ApiSuccessResponse({ data: ${JSON.stringify(data)}, message: ${quote(message)} })`,
                        ``,
                        ...comments
                    ].join('\n'),
                    notes: ['The constructor doesn\'t validate its input. A real response without a message, such as an auto-wrapped return value, makes getMessage() return undefined even though its type says string.', SUCCESS_CHECK_NOTE]
                })
            }

            if (responseClass === 'ApiErrorResponse') {
                if (!error) {
                    return toolError(`Error: ApiErrorResponse requires "error". ${paramRequirements.ApiErrorResponse}`)
                }
                if (!errors) {
                    return toolError(`Error: ApiErrorResponse requires "errors". ${paramRequirements.ApiErrorResponse}`)
                }

                const { methods, returnUndefined, comments } = describeGetters({ getError: error, getErrors: errors, getErrorCode: errorCode })
                return jsonResult({
                    responseClass,
                    input: { error, errors, ...(errorCode && { errorCode }) },
                    methods,
                    returnUndefined,
                    snippet: [
                        `import { ApiErrorResponse } from '@qnx/client'`,
                        ``,
                        `const res = new ApiErrorResponse(${JSON.stringify({ error, errors, ...(errorCode ? { errorCode } : {}) }, null, 2)})`,
                        ``,
                        ...comments
                    ].join('\n'),
                    notes: ['Only validation responses have "error" and "errors". On a real 401, 409 or 500, getError() and getErrors() return undefined, and this class has no getMessage().', SUCCESS_CHECK_NOTE]
                })
            }

            // ApiResponse — all fields optional
            const input = {
                ...(data !== undefined && { data }),
                ...(message && { message }),
                ...(error && { error }),
                ...(errors && { errors }),
                ...(errorCode && { errorCode })
            }
            const { methods, returnUndefined, comments } = describeGetters({
                getData: data,
                getMessage: message,
                getError: error,
                getErrors: errors,
                getErrorCode: errorCode
            })

            return jsonResult({
                responseClass,
                input,
                methods,
                returnUndefined,
                snippet: [
                    `import { ApiResponse } from '@qnx/client'`,
                    ``,
                    `const res = new ApiResponse(${JSON.stringify(input, null, 2)})`,
                    ``,
                    ...comments
                ].join('\n'),
                notes: [SUCCESS_CHECK_NOTE]
            })
        }
    )
}
