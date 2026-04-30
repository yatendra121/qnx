import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { generateAuthToken } from '@qnx/crypto'
import { z } from 'zod'

export function registerGenerateAuthTokenTool(server: McpServer) {
    server.registerTool(
        'generate-auth-token',
        {
            description: 'Generate a JWT/JWE auth token for a given subject (user ID)',
            inputSchema: { subject: z.string().describe('The subject to generate the token for (e.g. user ID)') }
        },
        async ({ subject }) => {
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
