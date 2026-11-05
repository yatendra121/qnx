import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { quote } from './quote'
import { jsonResult, readOnlyTool } from './shared'

// Ordered by severity. @qnx/winston writes `debug` and everything before it.
const logLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const
const LOWEST_WRITTEN_LEVEL = logLevels.indexOf('debug')

const levelDescriptions: Record<typeof logLevels[number], string> = {
    error: 'Failures that need attention',
    warn: 'Recoverable issues or deprecations',
    info: 'General operational events',
    http: 'HTTP request/response logging',
    verbose: 'Detailed flow tracing',
    debug: 'Development diagnostics',
    silly: 'Extremely verbose noise'
}

const STACK_PREVIEW = '    at <your stack frames>'

/** Winston's JSON format writes keys in sorted order, at every depth. */
function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (typeof value !== 'object' || value === null) return value
    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, nested]) => [key, sortKeys(nested)])
    )
}

/**
 * Builds the entry the way winston does. @qnx/winston can't run here because importing it creates a
 * log directory, which fails on a read-only host. tools.contract.spec.ts checks this against its real output.
 */
function buildEntry(level: string, message: string, metadata: Record<string, unknown> = {}, errorMessage?: string) {
    const entry: Record<string, unknown> = { ...metadata, level, message, timestamp: new Date().toISOString() }
    const hasMetadata = Object.keys(metadata).length > 0

    if (errorMessage !== undefined) {
        const stack = `Error: ${errorMessage}\n${STACK_PREVIEW}`
        if (hasMetadata) {
            entry.errorMessage = errorMessage
            entry.stack = stack
        } else {
            // Passing the Error itself: winston appends its message and copies its stack.
            entry.message = `${message} ${errorMessage}`
            entry.stack = stack
        }
    } else if (typeof metadata.message === 'string' && metadata.message) {
        // Winston appends a metadata `message` to the log message rather than replacing it.
        entry.message = `${message} ${metadata.message}`
    }
    return sortKeys(entry)
}

function buildCall(level: string, message: string, metadata: Record<string, unknown> = {}, errorMessage?: string) {
    const hasMetadata = Object.keys(metadata).length > 0
    if (errorMessage !== undefined) {
        const args = hasMetadata
            ? `{ ...${JSON.stringify(metadata)}, errorMessage: err.message, stack: err.stack }`
            : 'err'
        return `logger.${level}(${quote(message)}, ${args})`
    }
    return `logger.${level}(${quote(message)}${hasMetadata ? `, ${JSON.stringify(metadata)}` : ''})`
}

export function registerBuildLogEntryTool(server: McpServer) {
    server.registerTool(
        'build-file-log-entry',
        {
            ...readOnlyTool('Preview a file log entry'),
            description: [
                'Preview what a @qnx/winston logger call writes to the log file, and get the call.',
                'Pass errorMessage to preview logging a caught Error: logger.error(\'message\', err) is the form that keeps its stack. An Error nested in metadata, such as { error: err }, is written as {} and loses its message and stack.',
                '',
                'silly entries are never written: the file only receives debug and above.'
            ].join('\n'),
            inputSchema: {
                level: z.enum(logLevels).describe(
                    'error | warn | info | http | verbose | debug | silly'
                ),
                message: z.string().describe('The log message'),
                metadata: z.record(z.string(), z.unknown()).optional().describe(
                    'Optional structured metadata to attach (e.g. { userId: 1 }). Don\'t nest an Error here.'
                ),
                errorMessage: z.string().optional().describe(
                    'The message of a caught Error you are logging, to preview how its message and stack are written'
                )
            }
        },
        async ({ level, message, metadata, errorMessage }) => {
            const written = logLevels.indexOf(level) <= LOWEST_WRITTEN_LEVEL
            const notes: string[] = []

            if (!written) {
                notes.push(`${level} is below the logger's debug threshold, so this call writes nothing. Use debug or above.`)
            }
            for (const key of Object.keys(metadata ?? {})) {
                if (/^(error|err|e|exception)$/i.test(key)) {
                    notes.push(`If "${key}" holds an Error instance, it's written as {}, with no message or stack. Pass the Error as the second argument instead: use errorMessage to preview that.`)
                }
            }
            if (errorMessage !== undefined && metadata && Object.keys(metadata).length > 0) {
                notes.push('Winston only reads one Error argument, so to keep metadata as well, copy the Error\'s message and stack into the metadata as this snippet does.')
            }

            const body = buildCall(level, message, metadata, errorMessage)
            const call = errorMessage === undefined ? body : `try {\n    await riskyOperation()\n} catch (err) {\n    ${body}\n}`

            return jsonResult({
                level,
                description: levelDescriptions[level],
                written,
                fileEntry: written ? buildEntry(level, message, metadata, errorMessage) : null,
                snippet: `import { logger } from '@qnx/winston'\n\n${call}`,
                ...(notes.length > 0 && { notes })
            })
        }
    )
}
