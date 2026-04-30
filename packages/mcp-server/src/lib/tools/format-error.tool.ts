import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ValidationError, UnauthenticatedUserError, ServerError } from '@qnx/errors'
import { z } from 'zod'

const errorTypes = ['validation', 'unauthenticated', 'server'] as const

export function registerFormatErrorTool(server: McpServer) {
    server.registerTool(
        'format-error',
        {
            description: 'Format an error into a standard @qnx API error response structure',
            inputSchema: {
                type: z.enum(errorTypes).describe('Error type: validation | unauthenticated | server'),
                message: z.string().describe('The error message'),
                field: z.string().optional().describe('Field name for validation errors (optional)')
            }
        },
        async ({ type, message, field }) => {
            let error: ValidationError | UnauthenticatedUserError | ServerError

            if (type === 'validation') {
                const key = field ?? 'field'
                error = new ValidationError(message, { errRes: { errors: { [key]: [message] } } })
            } else if (type === 'unauthenticated') {
                error = new UnauthenticatedUserError(message)
            } else {
                error = new ServerError(message)
            }

            const formatted = {
                name: error.name,
                message: error.message,
                errorCode: error.errorCode,
                errorResponse: error.getErrorResponse()
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(formatted) }]
            }
        }
    )
}
