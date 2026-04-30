import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ApiResponse, ApiResponseErrorsValue } from '@qnx/response'
import { z } from 'zod'

export function registerBuildApiResponseTool(server: McpServer) {
    server.registerTool(
        'build-api-response',
        {
            description: 'Build a standard @qnx API response structure (data, message, errors) without sending it',
            inputSchema: {
                data: z.record(z.string(), z.unknown()).optional().describe('Response data payload'),
                message: z.string().optional().describe('Response message'),
                statusCode: z.number().optional().describe('HTTP status code (default: 200)'),
                errors: z.record(z.string(), z.string()).optional().describe('Field errors as { fieldName: errorMessage }'),
                error: z.string().optional().describe('Single top-level error message')
            }
        },
        async ({ data, message, errors, error, statusCode }) => {
            const apiResponse = ApiResponse.getInstance()

            if (data) apiResponse.setData(data)
            if (message) apiResponse.setMessage(message)
            if (statusCode) apiResponse.setStatusCode(statusCode)
            if (error) apiResponse.setError(error)

            if (errors) {
                const errorsValue = ApiResponseErrorsValue.getInstance()
                for (const [field, msg] of Object.entries(errors)) {
                    errorsValue.addError(field, msg)
                }
                apiResponse.setErrors(errorsValue.getErrors() ?? {})
            }

            const shape = { ...apiResponse }

            return {
                content: [{ type: 'text', text: JSON.stringify(shape) }]
            }
        }
    )
}
