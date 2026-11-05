import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ApiError, ApiResponseErrorsValue, ValidationError, InvalidValueError, UnauthenticatedUserError, ServerError } from '@qnx/errors'
import { errorApiResponse } from '@qnx/response'
import { z } from 'zod'
import { captureResponse, INVALID_STATUS_MESSAGE, isValidStatusCode } from './real-response'
import { jsonResult, readOnlyTool, toolError } from './shared'

const errorClasses = ['ApiError', 'ValidationError', 'InvalidValueError', 'UnauthenticatedUserError', 'ServerError'] as const

const paramRequirements: Record<typeof errorClasses[number], string> = {
    ApiError: 'Requires: message, statusCode. Optional: fields',
    ValidationError: 'Requires: message, fields (≥1 entry with field + message)',
    InvalidValueError: 'Requires: message, fields (exactly 1 entry, whose field name is the key)',
    UnauthenticatedUserError: 'Requires: message only',
    ServerError: 'Requires: message only'
}

export function registerFormatErrorTool(server: McpServer) {
    server.registerTool(
        'build-api-error',
        {
            ...readOnlyTool('Preview an error class'),
            description: [
                'Instantiate a real @qnx/errors class and return its code, message and errorResponse, plus the HTTP response asyncValidatorHandler sends for it.',
                '',
                'Required params per errorClass:',
                '  ApiError                 → message + statusCode, fields optional',
                '  ValidationError          → message + fields (≥1 entry, repeat a field for several messages)',
                '  InvalidValueError        → message + fields (exactly 1 entry)',
                '  UnauthenticatedUserError → message only',
                '  ServerError              → message only'
            ].join('\n'),
            inputSchema: {
                errorClass: z.enum(errorClasses).describe(
                    'ApiError | ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError'
                ),
                message: z.string().describe('The error message (required for all classes)'),
                statusCode: z.number().optional().describe('ApiError only (required) — the HTTP status code, e.g. 409'),
                fields: z.array(
                    z.object({
                        field: z.string().describe('Field name (e.g. "email")'),
                        message: z.string().describe('Error message for this field')
                    })
                ).optional().describe(
                    'ValidationError: required, ≥1 entry. InvalidValueError: required, exactly 1 entry. ApiError: optional. Others: not applicable.'
                )
            }
        },
        async ({ errorClass, message, statusCode, fields }) => {
            const notes: string[] = []
            const collectErrors = () => {
                const collected = ApiResponseErrorsValue.getInstance()
                for (const { field, message: fieldMessage } of fields ?? []) collected.addError(field, fieldMessage)
                return collected.getErrors() ?? {}
            }
            let error: ApiError

            if (fields?.length && (errorClass === 'UnauthenticatedUserError' || errorClass === 'ServerError')) {
                return toolError(`Error: ${errorClass} doesn't take "fields". ${paramRequirements[errorClass]}`)
            }

            if (errorClass === 'ApiError') {
                if (statusCode === undefined) {
                    return toolError(`Error: ApiError requires "statusCode". ${paramRequirements.ApiError}`)
                }
                if (!isValidStatusCode(statusCode)) {
                    return toolError(`Error: statusCode ${statusCode} is not valid. ${INVALID_STATUS_MESSAGE}`)
                }
                error = new ApiError(message, statusCode, fields?.length ? { errRes: { errors: collectErrors() } } : undefined)
            } else if (errorClass === 'ValidationError') {
                if (!fields || fields.length === 0) {
                    return toolError(`Error: ValidationError requires at least one entry in "fields". ${paramRequirements.ValidationError}`)
                }
                error = new ValidationError(message, { errRes: { errors: collectErrors() } })
                notes.push('This class\'s message never reaches the client. The response\'s "error" is the first field\'s first message.')
            } else if (errorClass === 'InvalidValueError') {
                if (fields?.length !== 1) {
                    return toolError(`Error: InvalidValueError requires exactly one entry in "fields". ${paramRequirements.InvalidValueError}`)
                }
                const [{ field, message: fieldMessage }] = fields
                error = new InvalidValueError(message, { key: field })
                if (fieldMessage !== message) {
                    notes.push(`InvalidValueError has one message, so "${message}" was used and the field's "${fieldMessage}" was ignored.`)
                }
            } else if (errorClass === 'UnauthenticatedUserError') {
                error = new UnauthenticatedUserError(message)
                notes.push('Your message isn\'t sent: the response body is always { errorCode: "unauthenticated", message: "Unauthenticated" }.')
            } else {
                error = new ServerError(message)
                notes.push('This message reaches the client, so keep it safe to show. setCallback isn\'t called for this class, so log the original error yourself.')
            }

            return jsonResult({
                errorClass,
                message: error.message,
                code: error.getCode(),
                errorResponse: error.getErrorResponse() ?? null,
                httpResponse: captureResponse((res) => errorApiResponse(res, error)),
                ...(notes.length > 0 && { notes })
            })
        }
    )
}
