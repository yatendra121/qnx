import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ApiError, InvalidValueError, ServerError, ValidationError } from '@qnx/errors'
import { errorApiResponse, initializeApiResponse, unauthenticateApiResponse } from '@qnx/response'
import { z } from 'zod'
import { captureResponse, INVALID_STATUS_MESSAGE, isValidStatusCode, type CapturedResponse } from './real-response'
import { jsonResult, readOnlyTool, toolError } from './shared'

const responseTypes = ['success', 'validation-error', 'invalid-value', 'custom-error', 'unauthenticated', 'server-error'] as const

type ProducedBy = {
    functions: string[]
    example: string
    imports: string[]
}

const producedByMap: Record<typeof responseTypes[number], ProducedBy> = {
    'success': {
        functions: ['initializeApiResponse', 'ApiResponse.getInstance'],
        example: `return initializeApiResponse().setData(data).setMessage('Saved successfully.')
// A different status, such as 201 for a create
return ApiResponse.getInstance().setStatusCode(201).setData(data)
// or return a raw value (auto-wrapped in { data: ... })
return { id: 1, name: 'Item' }`,
        imports: ['initializeApiResponse', 'ApiResponse']
    },
    'validation-error': {
        functions: ['throw ValidationError (recommended)', 'invalidApiResponse (escape hatch outside asyncValidatorHandler)'],
        example: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { ApiResponseErrorsValue, ValidationError } from '@qnx/errors'
const errors = ApiResponseErrorsValue.getInstance()
    .addError('email', 'Email is required.')
    .addError('name', 'Name is required.')
    .getErrors()
throw new ValidationError('Validation failed', { errRes: { errors } })

// Escape hatch — only for code outside asyncValidatorHandler (requires res)
return invalidApiResponse(res, errors)`,
        imports: ['ApiResponseErrorsValue from @qnx/errors', 'ValidationError from @qnx/errors']
    },
    'invalid-value': {
        functions: ['throw InvalidValueError (recommended)', 'throwInvalidValueApiResponse (deprecated)', 'invalidValueApiResponse (deprecated)'],
        example: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { InvalidValueError } from '@qnx/errors'
throw new InvalidValueError('Email is required.', { key: 'email' })

// ⚠️ Deprecated — throwInvalidValueApiResponse and invalidValueApiResponse
// produce the same response; use InvalidValueError instead.`,
        imports: ['InvalidValueError from @qnx/errors']
    },
    'custom-error': {
        functions: ['throw ApiError'],
        example: `// Throw from anywhere inside asyncValidatorHandler — responds with the given status code
import { ApiError } from '@qnx/errors'
throw new ApiError('Conflict detected.', 409)

// With field errors → { errors: { email: [...] }, error: 'Email already exists.', message: 'Conflict detected.' }
throw new ApiError('Conflict detected.', 409, {
    errRes: { errors: { email: ['Email already exists.'] } }
})`,
        imports: ['ApiError from @qnx/errors']
    },
    'unauthenticated': {
        functions: ['throw UnauthenticatedUserError (recommended)', 'unauthenticateApiResponse'],
        example: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler.
// The body is always { errorCode: 'unauthenticated', message: 'Unauthenticated' }: your message isn't sent.
import { UnauthenticatedUserError } from '@qnx/errors'
throw new UnauthenticatedUserError('Session expired')

// Alternative — direct response (requires res, only at route handler level)
return unauthenticateApiResponse(res)`,
        imports: ['UnauthenticatedUserError from @qnx/errors']
    },
    'server-error': {
        functions: ['throw ServerError (safe to show)', 'throw Error (unexpected errors, reaches the client)', 'serverErrorApiResponse'],
        example: `// ✅ Safe — responds 500 { message } with no stack trace, but setCallback isn't called, so log it yourself
import { ServerError } from '@qnx/errors'
logger.error('Payment failed', err)
throw new ServerError('Payment could not be processed.')

// ⚠️ Any other error thrown inside asyncValidatorHandler responds 500 { serverError: { name, message, stack } }`,
        imports: ['ServerError from @qnx/errors']
    }
}

const STACK_PLACEHOLDER = '<full stack trace, including your server\'s file paths>'

function hideRealStack({ statusCode, body }: CapturedResponse): CapturedResponse {
    const { serverError } = body as { serverError: Record<string, unknown> }
    return { statusCode, body: { serverError: { ...serverError, stack: STACK_PLACEHOLDER } } }
}

export function registerBuildApiResponseTool(server: McpServer) {
    server.registerTool(
        'build-api-response',
        {
            ...readOnlyTool('Preview an API response'),
            description: [
                'Run the real @qnx/response code and show the HTTP status code and exact response body it sends, plus the function that produces it and its imports.',
                'Field usage per type:',
                '  success          → data (optional), message (optional), statusCode (optional, default 200)',
                '  validation-error → errors (required)',
                '  invalid-value    → field (required), error (required)',
                '  custom-error     → error (required), statusCode (required), errors (optional)',
                '  unauthenticated  → no extra fields',
                '  server-error     → error (optional)'
            ].join('\n'),
            inputSchema: {
                type: z.enum(responseTypes).describe(
                    'success | validation-error | invalid-value | custom-error | unauthenticated | server-error'
                ),
                data: z.unknown().optional().describe(
                    'success only — response payload, wrapped as { data: ... }'
                ),
                message: z.string().optional().describe(
                    'success only — human-readable success message'
                ),
                errors: z.record(z.string(), z.array(z.string())).optional().describe(
                    'validation-error (required) | custom-error (optional) — field errors map: { fieldName: ["error msg"] }'
                ),
                field: z.string().optional().describe(
                    'invalid-value only (required) — the name of the invalid field'
                ),
                error: z.string().optional().describe(
                    'invalid-value | custom-error | server-error only — the error message'
                ),
                statusCode: z.number().optional().describe(
                    'custom-error (required) | success (optional) — the HTTP status code, e.g. 409 or 201'
                )
            }
        },
        async ({ type, data, message, errors, field, error, statusCode: customStatusCode }) => {
            const notes: string[] = []
            let response: CapturedResponse

            if (customStatusCode !== undefined && !isValidStatusCode(customStatusCode)) {
                return toolError(`Error: statusCode ${customStatusCode} is not valid. ${INVALID_STATUS_MESSAGE}`)
            }

            if (type === 'success') {
                const apiResponse = initializeApiResponse()
                if (data !== undefined) apiResponse.setData(data)
                if (message !== undefined) apiResponse.setMessage(message)
                if (customStatusCode !== undefined) apiResponse.setStatusCode(customStatusCode)
                response = captureResponse((res) => apiResponse.response(res))
                if (data === undefined && message === undefined) {
                    notes.push('Returning nothing from the handler is different: it calls next(), usually ending in an HTML 404. Return a message or data.')
                }
            } else if (type === 'validation-error') {
                if (!errors) {
                    return toolError('Error: validation-error requires "errors", for example { "email": ["Email is required."] }.')
                }
                const validationError = new ValidationError('Validation failed', { errRes: { errors } })
                response = captureResponse((res) => errorApiResponse(res, validationError))
                notes.push('The ValidationError message never reaches the client. "error" is the first field\'s first message.')
                if (Object.keys(errors).length === 0) notes.push('With no field errors the body has no "error" key, so clients have nothing to show.')
            } else if (type === 'invalid-value') {
                if (!field || !error) {
                    return toolError('Error: invalid-value requires "field" and "error".')
                }
                const invalidValueError = new InvalidValueError(error, { key: field })
                response = captureResponse((res) => errorApiResponse(res, invalidValueError))
            } else if (type === 'custom-error') {
                if (!error || customStatusCode === undefined) {
                    return toolError('Error: custom-error requires "error" and "statusCode".')
                }
                const apiError = new ApiError(error, customStatusCode, errors ? { errRes: { errors } } : undefined)
                response = captureResponse((res) => errorApiResponse(res, apiError))
                if (customStatusCode < 400) notes.push(`Status ${customStatusCode} isn't an error status, so clients checking response.ok treat this as success.`)
                notes.push('The body has "message" and no "error" unless field errors are given, so clients need response.ok or the status to detect it. ApiResponse.getError() returns undefined here.')
            } else if (type === 'unauthenticated') {
                response = captureResponse((res) => unauthenticateApiResponse(res))
                notes.push('The body is the same whatever message you give UnauthenticatedUserError.')
            } else {
                const errorMessage = error ?? 'Internal server error'
                response = hideRealStack(captureResponse((res) => errorApiResponse(res, new Error(errorMessage))))
                const safe = captureResponse((res) => errorApiResponse(res, new ServerError(errorMessage)))
                return jsonResult({
                    ...response,
                    warning: 'This body reaches the client in every environment and can\'t be turned off: the error message and the full stack trace, including file paths. Don\'t let errors with sensitive details, such as database connection strings, reach this path.',
                    saferAlternative: {
                        description: 'throw new ServerError(message) sends only the message you choose. setCallback isn\'t called for it, so log the original error first.',
                        ...safe
                    },
                    producedBy: producedByMap[type],
                    docs: 'get-response-docs { "pattern": "server-error" }'
                })
            }

            return jsonResult({
                ...response,
                ...(notes.length > 0 && { notes }),
                producedBy: producedByMap[type]
            })
        }
    )
}

