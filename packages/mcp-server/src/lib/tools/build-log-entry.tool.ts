import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const logLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const

const levelDescriptions: Record<typeof logLevels[number], string> = {
    error: 'Failures that need attention',
    warn: 'Recoverable issues or deprecations',
    info: 'General operational events',
    http: 'HTTP request/response logging',
    verbose: 'Detailed flow tracing',
    debug: 'Development diagnostics',
    silly: 'Extremely verbose noise'
}

export function registerBuildLogEntryTool(server: McpServer) {
    server.registerTool(
        'build-file-log-entry',
        {
            description: [
                'Preview what a @qnx/winston log entry looks like when written to the log file, and get the corresponding logger call.',
                '',
                'Required params per level:',
                '  error   → message (required), metadata (optional, include { error } for stack trace)',
                '  warn    → message (required), metadata (optional)',
                '  info    → message (required), metadata (optional)',
                '  http    → message (required), metadata (optional)',
                '  verbose → message (required), metadata (optional)',
                '  debug   → message (required), metadata (optional)',
                '  silly   → message (required), metadata (optional)'
            ].join('\n'),
            inputSchema: {
                level: z.enum(logLevels).describe(
                    'error | warn | info | http | verbose | debug | silly'
                ),
                message: z.string().describe('The log message'),
                metadata: z.record(z.string(), z.unknown()).optional().describe(
                    'Optional structured metadata to attach (e.g. { userId: 1, error: err })'
                )
            }
        },
        async ({ level, message, metadata }) => {
            const timestamp = new Date().toISOString()

            const fileEntry: Record<string, unknown> = {
                level,
                message,
                timestamp,
                ...metadata
            }

            const hasError = metadata && 'error' in metadata
            if (hasError) {
                fileEntry.stack = `Error: ${message}\n    at yourFunction (your-file.ts:10:5)`
            }

            const metaArg = metadata && Object.keys(metadata).length > 0
                ? `, ${JSON.stringify(metadata)}`
                : ''

            const snippet = `import { logger } from '@qnx/winston'\n\nlogger.${level}('${message}'${metaArg})`

            const result = {
                level,
                description: levelDescriptions[level],
                fileEntry,
                snippet
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            }
        }
    )
}
