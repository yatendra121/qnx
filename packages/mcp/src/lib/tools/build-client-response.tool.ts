import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const responseClasses = ['ApiResponse', 'ApiSuccessResponse', 'ApiErrorResponse'] as const

const paramRequirements: Record<typeof responseClasses[number], string> = {
    ApiResponse: 'All fields optional. Provide any combination of data, message, error, errors, errorCode.',
    ApiSuccessResponse: 'Requires: data + message. No error fields.',
    ApiErrorResponse: 'Requires: error + errors. errorCode is optional.'
}

export function registerBuildClientResponseTool(server: McpServer) {
    server.registerTool(
        'build-client-response',
        {
            description: [
                'Instantiate a @qnx/client response class with real values and show what each method returns.',
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
                    return {
                        content: [{ type: 'text', text: `Error: ApiSuccessResponse requires "data". ${paramRequirements.ApiSuccessResponse}` }]
                    }
                }
                if (!message) {
                    return {
                        content: [{ type: 'text', text: `Error: ApiSuccessResponse requires "message". ${paramRequirements.ApiSuccessResponse}` }]
                    }
                }

                const result = {
                    responseClass,
                    input: { data, message },
                    methods: {
                        getData: data,
                        getMessage: message
                    },
                    snippet: [
                        `import { ApiSuccessResponse } from '@qnx/client'`,
                        ``,
                        `const res = new ApiSuccessResponse({ data: ${JSON.stringify(data)}, message: '${message}' })`,
                        ``,
                        `res.getData()    // ${JSON.stringify(data)}`,
                        `res.getMessage() // '${message}'`
                    ].join('\n')
                }

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                }
            }

            if (responseClass === 'ApiErrorResponse') {
                if (!error) {
                    return {
                        content: [{ type: 'text', text: `Error: ApiErrorResponse requires "error". ${paramRequirements.ApiErrorResponse}` }]
                    }
                }
                if (!errors) {
                    return {
                        content: [{ type: 'text', text: `Error: ApiErrorResponse requires "errors". ${paramRequirements.ApiErrorResponse}` }]
                    }
                }

                const result = {
                    responseClass,
                    input: { error, errors, errorCode: errorCode ?? undefined },
                    methods: {
                        getError: error,
                        getErrors: errors,
                        getErrorCode: errorCode ?? undefined
                    },
                    snippet: [
                        `import { ApiErrorResponse } from '@qnx/client'`,
                        ``,
                        `const res = new ApiErrorResponse(${JSON.stringify({ error, errors, ...(errorCode ? { errorCode } : {}) }, null, 2)})`,
                        ``,
                        `res.getError()     // '${error}'`,
                        `res.getErrors()    // ${JSON.stringify(errors)}`,
                        `res.getErrorCode() // ${errorCode ? `'${errorCode}'` : 'undefined'}`
                    ].join('\n')
                }

                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                }
            }

            // ApiResponse — all fields optional
            const input = {
                ...(data !== undefined && { data }),
                ...(message && { message }),
                ...(error && { error }),
                ...(errors && { errors }),
                ...(errorCode && { errorCode })
            }

            const result = {
                responseClass,
                input,
                methods: {
                    getData: data ?? null,
                    getMessage: message ?? null,
                    getError: error ?? null,
                    getErrors: errors ?? null,
                    getErrorCode: errorCode ?? null
                },
                snippet: [
                    `import { ApiResponse } from '@qnx/client'`,
                    ``,
                    `const res = new ApiResponse(${JSON.stringify(input, null, 2)})`,
                    ``,
                    `res.getData()      // ${data !== undefined ? JSON.stringify(data) : 'undefined'}`,
                    `res.getMessage()   // ${message ? `'${message}'` : 'undefined'}`,
                    `res.getError()     // ${error ? `'${error}'` : 'undefined'}`,
                    `res.getErrors()    // ${errors ? JSON.stringify(errors) : 'undefined'}`,
                    `res.getErrorCode() // ${errorCode ? `'${errorCode}'` : 'undefined'}`
                ].join('\n')
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            }
        }
    )
}
