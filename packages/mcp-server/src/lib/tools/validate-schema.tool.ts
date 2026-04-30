import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerValidateSchemaTool(server: McpServer) {
    server.registerTool(
        'validate-schema',
        {
            description: 'Validate a JSON value against a Zod schema definition (object field types)',
            inputSchema: {
                schema: z
                    .record(z.string(), z.enum(['string', 'number', 'boolean', 'email', 'url']))
                    .describe('Field definitions as { fieldName: type }. Supported types: string, number, boolean, email, url'),
                data: z.record(z.string(), z.unknown()).describe('The JSON object to validate against the schema')
            }
        },
        async ({ schema, data }) => {
            const shape: Record<string, z.ZodTypeAny> = {}

            for (const [field, type] of Object.entries(schema)) {
                if (type === 'string') shape[field] = z.string()
                else if (type === 'number') shape[field] = z.number()
                else if (type === 'boolean') shape[field] = z.boolean()
                else if (type === 'email') shape[field] = z.string().email()
                else if (type === 'url') shape[field] = z.string().url()
            }

            const result = z.object(shape).safeParse(data)

            if (result.success) {
                return {
                    content: [{ type: 'text', text: JSON.stringify({ valid: true, data: result.data }) }]
                }
            }

            const errors: Record<string, string[]> = {}
            for (const issue of result.error.issues) {
                const key = issue.path.join('.') || 'root'
                if (!errors[key]) errors[key] = []
                errors[key].push(issue.message)
            }

            return {
                content: [{ type: 'text', text: JSON.stringify({ valid: false, errors }) }],
                isError: true
            }
        }
    )
}
