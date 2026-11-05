import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readOnlyTool, textResult } from './shared'

const topics = ['usage', 'levels', 'output', 'logging-errors', 'configuration', 'patterns', 'all'] as const

export const loggerDocs: Record<Exclude<typeof topics[number], 'all'>, string> = {
    usage: `## Usage

**Installation**
\`\`\`bash
npm install @qnx/winston winston winston-daily-rotate-file
\`\`\`

**Import**
\`\`\`ts
import { logger } from '@qnx/winston'
\`\`\`

**Basic examples**
\`\`\`ts
logger.info('Server started on port 3000')
logger.warn('Deprecated endpoint called')
logger.error('Something went wrong', err) // pass an Error as the second argument: see logging-errors
logger.debug('User data', { user })
\`\`\`

> The logger is a pre-configured singleton — import and use it directly with no additional setup required.
> Importing it creates a \`logs\` directory under the current working directory. If that can't be created, such as on a read-only filesystem, the import itself throws.`,

    levels: `## Log Levels

Winston uses the following levels in order of severity (lowest → highest):

| Level | Method | When to use |
| --- | --- | --- |
| \`silly\` | \`logger.silly()\` | Extremely verbose noise |
| \`debug\` | \`logger.debug()\` | Development diagnostics |
| \`verbose\` | \`logger.verbose()\` | Detailed flow tracing |
| \`http\` | \`logger.http()\` | HTTP request/response logging |
| \`info\` | \`logger.info()\` | General operational events |
| \`warn\` | \`logger.warn()\` | Recoverable issues or deprecations |
| \`error\` | \`logger.error()\` | Failures that need attention |

**Active level**
\`debug\` and above are logged in every environment. \`NODE_ENV\` is not consulted, and \`silly\` entries are never written.

**Passing metadata**
\`\`\`ts
logger.info('User created', { userId: 42, email: 'user@example.com' })
logger.warn('Retrying connection', { retries: 3 })
\`\`\``,

    output: `## Log Output Structure

Logs are written to a daily rotated file. There is no console transport.

### File (daily rotated)
- Format: **JSON**, with keys in alphabetical order. A stack trace is included only when you log an Error as the second argument: see logging-errors
- Location: \`logs/YYYY-MM-DD.log\`
- Rotation: daily, zipped archive, max \`20mb\` per file, kept for \`14 days\`

\`\`\`json
{
  "level": "info",
  "message": "Server started on port 3000",
  "timestamp": "2025-07-28T10:00:00.000Z"
}
\`\`\`

\`\`\`json
{
  "level": "error",
  "message": "Payment failed card declined",
  "stack": "Error: card declined\\n    at ...",
  "timestamp": "2025-07-28T10:01:00.000Z"
}
\`\`\`

### File structure
\`\`\`
logs/
├── 2025-07-27.log.gz   ← archived previous days
├── 2025-07-28.log      ← today's active log
└── 2025-07-29.log
\`\`\``,

    'logging-errors': `## Logging Errors

**Pass the Error as the second argument.** It's the only form that keeps both the message and the stack.

| Call | Written to the file |
| --- | --- |
| ✅ \`logger.error('Payment failed', err)\` | \`message: "Payment failed card declined"\` and \`stack\` |
| ❌ \`logger.error('Payment failed', { error: err })\` | \`error: {}\`, so **no error message and no stack** |
| ❌ \`logger.error(err)\` | **No message and no stack** |

Winston appends the Error's message to yours, and copies any extra properties, such as \`code\`, onto the entry.

**To add metadata**, copy the Error's fields into it. Winston only reads one such argument:

\`\`\`ts
import { logger } from '@qnx/winston'

try {
    await chargeCard(order)
} catch (err) {
    const error = err as Error
    logger.error('Payment failed', { orderId: order.id, errorMessage: error.message, stack: error.stack })
}
\`\`\`

**Uncaught exceptions** are also written, and the process keeps running because \`exitOnError\` is \`false\`. They can leave your app in a bad state, so decide whether you want to exit in your own handler.`,

    configuration: `## Configuration

The logger comes pre-configured — no setup needed. Key defaults:

| Setting | Value |
| --- | --- |
| Log directory | \`logs/\` (auto-created if missing) |
| File name pattern | \`YYYY-MM-DD.log\` |
| Max file size | \`20mb\` |
| Retention | \`14 days\` |
| Archive | Gzip compressed |
| Exception handling | Enabled (unhandled exceptions are logged) |
| Exit on error | \`false\` (the process keeps running after an uncaught exception) |
| File format | JSON + timestamp + error stack |

**Customizing**

The package does not expose configuration options. To customize transports, formats, or log paths, wrap or fork the logger:

\`\`\`ts
import { createLogger, transports, format } from 'winston'
import 'winston-daily-rotate-file'

export const logger = createLogger({
    transports: [
        new transports.DailyRotateFile({
            filename: 'logs/%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '30d',
            format: format.combine(format.errors({ stack: true }), format.timestamp(), format.json())
        })
    ]
})
\`\`\``,

    patterns: `## Common Patterns

### Request logging middleware (Express)
\`\`\`ts
import { logger } from '@qnx/winston'

app.use((req, res, next) => {
    logger.http(\`\${req.method} \${req.url}\`, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
    })
    next()
})
\`\`\`

### Error logging in try/catch
\`\`\`ts
import { logger } from '@qnx/winston'

try {
    await riskyOperation()
} catch (error) {
    logger.error('Operation failed', error as Error)
}
\`\`\`

### Logging inside asyncValidatorHandler (@qnx/response)
\`\`\`ts
import { asyncValidatorHandler } from '@qnx/response'
import { logger } from '@qnx/winston'

router.post('/items', asyncValidatorHandler(async (req) => {
    logger.info('Creating item', { body: req.body })
    const item = await createItem(req.body)
    logger.info('Item created', { id: item.id })
    return item
}))
\`\`\`

### Logging with structured metadata
\`\`\`ts
logger.info('Payment processed', {
    userId: 123,
    amount: 49.99,
    currency: 'USD',
    transactionId: 'txn_abc123'
})
\`\`\``
}

export function registerLoggerDocsTool(server: McpServer) {
    server.registerTool(
        'get-file-logger-docs',
        {
            ...readOnlyTool('@qnx/winston docs'),
            description: 'Get documentation for @qnx/winston — zero-config Winston logger that writes structured JSON to daily-rotating files. Use when you need persistent, production-grade file logging with automatic retention and archiving. Read logging-errors before logging an Error: the common { error: err } form loses it. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe(
                    'usage | levels | output | logging-errors | configuration | patterns | all'
                )
            }
        },
        async ({ topic }) => textResult(
            topic === 'all'
                ? ['# `@qnx/winston` Reference\n', ...Object.values(loggerDocs)].join('\n\n---\n\n')
                : loggerDocs[topic]
        )
    )
}
