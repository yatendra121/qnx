import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { errorCodes } from '@qnx/errors'
import { z } from 'zod'

const responseTypes = ['success', 'validation-error', 'invalid-value', 'unauthenticated', 'server-error'] as const

type ProducedBy = {
    functions: string[]
    example: string
    imports: string[]
}

const producedByMap: Record<typeof responseTypes[number], ProducedBy> = {
    'success': {
        functions: ['initializeApiResponse', 'ApiResponse.getInstance'],
        example: `return initializeApiResponse().setData(data).setMessage('Created successfully.')
// or return raw value (auto-wrapped in { data: ... })
return { id: 1, name: 'Item' }`,
        imports: ['initializeApiResponse']
    },
    'validation-error': {
        functions: ['throw ValidationError (recommended)', 'invalidApiResponse'],
        example: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { ValidationError } from '@qnx/errors'
import { ApiResponseErrorsValue } from '@qnx/response'
const errors = ApiResponseErrorsValue.getInstance()
    .addError('email', 'Email is required.')
    .addError('name', 'Name is required.')
    .getErrors()
throw new ValidationError('Validation failed', { errRes: { errors } })

// Alternative — direct response (requires res, only at route handler level)
return invalidApiResponse(res, errors)`,
        imports: ['ValidationError from @qnx/errors', 'ApiResponseErrorsValue']
    },
    'invalid-value': {
        functions: ['throw InvalidValueError (recommended)', 'throwInvalidValueApiResponse', 'invalidValueApiResponse'],
        example: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { InvalidValueError } from '@qnx/errors'
throw new InvalidValueError('Email is required.', { key: 'email' })

// Alternative shorthand alias
throwInvalidValueApiResponse('email', 'Email is required.')

// Alternative — direct response (requires res, only at route handler level)
return invalidValueApiResponse(res, 'email', 'Email is required.')`,
        imports: ['InvalidValueError from @qnx/errors']
    },
    'unauthenticated': {
        functions: ['throw UnauthenticatedUserError (recommended)', 'unauthenticateApiResponse'],
        example: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { UnauthenticatedUserError } from '@qnx/errors'
throw new UnauthenticatedUserError('Not authenticated')

// Alternative — direct response (requires res, only at route handler level)
return unauthenticateApiResponse(res)`,
        imports: ['UnauthenticatedUserError from @qnx/errors']
    },
    'server-error': {
        functions: ['serverErrorApiResponse', 'throw Error (auto-caught)'],
        example: `// Any unhandled error thrown inside asyncValidatorHandler produces this
throw new Error('Something went wrong')`,
        imports: []
    }
}

export function registerBuildApiResponseTool(server: McpServer) {
    server.registerTool(
        'build-api-response',
        {
            description: [
                'Show the HTTP status code, exact response body shape, the @qnx/response function that produces it, and the required imports.',
                'Field usage per type:',
                '  success          → data (optional), message (optional)',
                '  validation-error → errors (required)',
                '  invalid-value    → field (required), error (required)',
                '  unauthenticated  → no extra fields',
                '  server-error     → error (optional)'
            ].join('\n'),
            inputSchema: {
                type: z.enum(responseTypes).describe(
                    'success | validation-error | invalid-value | unauthenticated | server-error'
                ),
                data: z.record(z.string(), z.unknown()).optional().describe(
                    'success only — response payload, wrapped as { data: ... }'
                ),
                message: z.string().optional().describe(
                    'success only — human-readable success message'
                ),
                errors: z.record(z.string(), z.array(z.string())).optional().describe(
                    'validation-error only (required) — field errors map: { fieldName: ["error msg"] }'
                ),
                field: z.string().optional().describe(
                    'invalid-value only (required) — the name of the invalid field'
                ),
                error: z.string().optional().describe(
                    'invalid-value | server-error only — the error message'
                )
            }
        },
        async ({ type, data, message, errors, field, error }) => {
            let statusCode: number
            let body: Record<string, unknown>

            if (type === 'success') {
                statusCode = 200
                body = {}
                if (data !== undefined) body.data = data
                if (message !== undefined) body.message = message
            } else if (type === 'validation-error') {
                statusCode = errorCodes.VALIDATION_ERROR_CODE
                const derivedError = errors ? Object.values(errors)[0]?.[0] ?? '' : ''
                body = { errors: errors ?? {}, error: derivedError }
            } else if (type === 'invalid-value') {
                statusCode = errorCodes.VALIDATION_ERROR_CODE
                const key = field ?? 'field'
                const msg = error ?? 'Invalid value'
                body = { errors: { [key]: [msg] }, error: msg }
            } else if (type === 'unauthenticated') {
                statusCode = errorCodes.UNAUTHENTICATED_USER_ERROR_CODE
                body = { errorCode: 'unauthenticated', message: 'Unauthenticated' }
            } else {
                statusCode = errorCodes.SERVER_ERROR_CODE
                body = { serverError: { name: 'Error', message: error ?? 'Internal server error', stack: '...' } }
            }

            const result = {
                statusCode,
                body,
                producedBy: producedByMap[type]
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            }
        }
    )
}
