import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { logger } from '@qnx/winston'
import { z } from 'zod'

const logLevels = ['info', 'warn', 'error', 'debug'] as const

export function registerLogMessageTool(server: McpServer) {
    server.registerTool(
        'log-message',
        {
            description: 'Write a log entry via Winston logger',
            inputSchema: {
                level: z.enum(logLevels).describe('Log level: info | warn | error | debug'),
                message: z.string().describe('The message to log'),
                meta: z.record(z.string(), z.unknown()).optional().describe('Optional metadata to attach to the log entry')
            }
        },
        async ({ level, message, meta }) => {
            logger[level](message, meta ?? {})
            return {
                content: [{ type: 'text', text: JSON.stringify({ logged: true, level, message }) }]
            }
        }
    )
}
