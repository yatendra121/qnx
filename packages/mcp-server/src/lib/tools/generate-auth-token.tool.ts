import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { generateAuthToken } from '@qnx/crypto'
import { z } from 'zod'

const REQUIRED_ENV_VARS = ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'JWE_PRIVATE_KEY', 'JWE_PUBLIC_KEY']

export function registerGenerateAuthTokenTool(server: McpServer) {
    server.registerTool(
        'generate-auth-token',
        {
            description: 'Generate a JWT/JWE auth token for a given subject (user ID)',
            inputSchema: { subject: z.string().describe('The subject to generate the token for (e.g. user ID)') }
        },
        async ({ subject }) => {
            const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
            if (missing.length > 0) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error: Missing environment variables: ${missing.join(', ')}`
                    }],
                    isError: true
                }
            }

            try {
                const result = await generateAuthToken(subject)
                return { content: [{ type: 'text', text: JSON.stringify(result) }] }
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true
                }
            }
        }
    )
}
