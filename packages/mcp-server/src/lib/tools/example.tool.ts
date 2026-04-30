import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerExampleTool(server: McpServer) {
    server.registerTool(
        'example',
        {
            description: 'An example tool that echoes back a message',
            inputSchema: { message: z.string().describe('Message to echo') }
        },
        async ({ message }) => ({
            content: [{ type: 'text', text: `Echo: ${message}` }]
        })
    )
}
