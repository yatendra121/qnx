import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ValidationError, InvalidValueError, UnauthenticatedUserError, ServerError } from '@qnx/errors'
import { z } from 'zod'

const errorClasses = ['ValidationError', 'InvalidValueError', 'UnauthenticatedUserError', 'ServerError'] as const

const paramRequirements: Record<typeof errorClasses[number], string> = {
    ValidationError: 'Requires: message, fields (≥1 entry with field + message)',
    InvalidValueError: 'Requires: message, fields (exactly 1 entry with field + message)',
    UnauthenticatedUserError: 'Requires: message only — fields is ignored',
    ServerError: 'Requires: message only — fields is ignored'
}

export function registerFormatErrorTool(server: McpServer) {
    server.registerTool(
        'build-api-error',
        {
            description: [
                'Instantiate a @qnx/errors class with real values and return its resolved code, message, and errorResponse.',
                '',
                'Required params per errorClass:',
                '  ValidationError          → message + fields (≥1 entry)',
                '  InvalidValueError        → message + fields (exactly 1 entry)',
                '  UnauthenticatedUserError → message only',
                '  ServerError              → message only'
            ].join('\n'),
            inputSchema: {
                errorClass: z.enum(errorClasses).describe(
                    'ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError'
                ),
                message: z.string().describe('The error message (required for all classes)'),
                fields: z.array(
                    z.object({
                        field: z.string().describe('Field name (e.g. "email")'),
                        message: z.string().describe('Error message for this field')
                    })
                ).optional().describe(
                    'ValidationError: required, ≥1 entry. InvalidValueError: required, first entry used. Others: not applicable.'
                )
            }
        },
        async ({ errorClass, message, fields }) => {
            if (errorClass === 'ValidationError') {
                if (!fields || fields.length === 0) {
                    return {
                        content: [{ type: 'text', text: `Error: ValidationError requires at least one entry in "fields". ${paramRequirements.ValidationError}` }]
                    }
                }

                const errors: Record<string, string[]> = {}
                for (const f of fields) errors[f.field] = [f.message]
                const error = new ValidationError(message, { errRes: { errors } })

                return {
                    content: [{ type: 'text', text: JSON.stringify({
                        errorClass,
                        message: error.message,
                        code: error.getCode(),
                        errorResponse: error.getErrorResponse()
                    }, null, 2) }]
                }
            }

            if (errorClass === 'InvalidValueError') {
                if (!fields || fields.length === 0) {
                    return {
                        content: [{ type: 'text', text: `Error: InvalidValueError requires exactly one entry in "fields". ${paramRequirements.InvalidValueError}` }]
                    }
                }

                const { field, message: fieldMessage } = fields[0]
                const error = new InvalidValueError(fieldMessage, { key: field })

                return {
                    content: [{ type: 'text', text: JSON.stringify({
                        errorClass,
                        message: error.message,
                        code: error.getCode(),
                        errorResponse: error.getErrorResponse()
                    }, null, 2) }]
                }
            }

            if (errorClass === 'UnauthenticatedUserError') {
                const error = new UnauthenticatedUserError(message)
                return {
                    content: [{ type: 'text', text: JSON.stringify({
                        errorClass,
                        message: error.message,
                        code: error.getCode(),
                        errorResponse: null
                    }, null, 2) }]
                }
            }

            // ServerError
            const error = new ServerError(message)
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    errorClass,
                    message: error.message,
                    code: error.getCode(),
                    errorResponse: null
                }, null, 2) }]
            }
        }
    )
}
