import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const logTypes = ['info', 'error', 'success', 'warning'] as const

const typeColors: Record<typeof logTypes[number], string> = {
    info: 'cyan',
    error: 'red',
    success: 'green',
    warning: 'yellow'
}

export function registerBuildConsoleLogTool(server: McpServer) {
    server.registerTool(
        'build-console-log',
        {
            description: 'Preview what a @qnx/log console output looks like and get the corresponding consoleLog() call.',
            inputSchema: {
                type: z.enum(logTypes).describe('info | error | success | warning'),
                message: z.string().describe('The message to log')
            }
        },
        async ({ type, message }) => {
            const result = {
                type,
                color: typeColors[type],
                consoleOutput: `[${typeColors[type].toUpperCase()}] ${message}`,
                snippet: type === 'info'
                    ? `import { consoleLog } from '@qnx/log'\n\nconsoleLog('${message}')`
                    : `import { consoleLog } from '@qnx/log'\n\nconsoleLog('${message}', { type: '${type}' })`
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            }
        }
    )
}
