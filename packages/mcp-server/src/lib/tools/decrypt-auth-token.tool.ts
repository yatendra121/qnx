import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { decryptAuthToken } from '@qnx/crypto'
import { z } from 'zod'

const REQUIRED_ENV_VARS = ['JWT_PUBLIC_KEY', 'JWE_PRIVATE_KEY']

export function registerDecryptAuthTokenTool(server: McpServer) {
    server.registerTool(
        'decrypt-auth-token',
        {
            description: 'Decrypt and verify a JWE auth token, returning its JWT payload',
            inputSchema: { token: z.string().describe('The JWE auth token to decrypt and verify') }
        },
        async ({ token }) => {
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
                const payload = await decryptAuthToken(token)
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
