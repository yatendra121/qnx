import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { decyptAuthToken } from '@qnx/crypto'
import { z } from 'zod'

export function registerDecryptAuthTokenTool(server: McpServer) {
    server.registerTool(
        'decrypt-auth-token',
        {
            description: 'Decrypt and verify a JWE auth token, returning its JWT payload',
            inputSchema: { token: z.string().describe('The JWE auth token to decrypt and verify') }
        },
        async ({ token }) => {
            try {
                const payload = await decyptAuthToken(token)
                return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true
                }
            }
        }
    )
}
