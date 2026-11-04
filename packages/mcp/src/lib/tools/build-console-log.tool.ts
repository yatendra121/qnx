import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { quote } from './quote'

const logTypes = ['info', 'success', 'warn', 'warning', 'error', 'debug', 'trace'] as const

const typeStyles: Record<typeof logTypes[number], { color: string; icon: string }> = {
    info: { color: 'blue', icon: 'ⓘ' },
    success: { color: 'green', icon: '✓' },
    warn: { color: 'yellow', icon: '⚠' },
    warning: { color: 'yellow', icon: '⚠' },
    error: { color: 'red', icon: '✗' },
    debug: { color: 'magenta', icon: '◇' },
    trace: { color: 'cyan', icon: '☆' }
}

export function registerBuildConsoleLogTool(server: McpServer) {
    server.registerTool(
        'build-console-log',
        {
            description: 'Preview what a @qnx/log console output looks like and get the corresponding consoleLog() call.',
            inputSchema: {
                type: z.enum(logTypes).describe('info | success | warn | error | debug | trace (warning is a deprecated alias of warn)'),
                message: z.string().describe('The message to log')
            }
        },
        async ({ type, message }) => {
            const { color, icon } = typeStyles[type]
            // The deprecated alias previews the same output but never appears in generated code.
            const snippetType = type === 'warning' ? 'warn' : type
            const result = {
                type,
                color,
                consoleOutput: `${icon}  ${message}`,
                snippet: snippetType === 'info'
                    ? `import { consoleLog } from '@qnx/log'\n\nconsoleLog(${quote(message)})`
                    : `import { consoleLog } from '@qnx/log'\n\nconsoleLog(${quote(message)}, { type: '${snippetType}' })`
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            }
        }
    )
}
