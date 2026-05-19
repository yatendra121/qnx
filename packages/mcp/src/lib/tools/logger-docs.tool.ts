import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const topics = ['usage', 'levels', 'output', 'configuration', 'patterns', 'all'] as const

const docs: Record<Exclude<typeof topics[number], 'all'>, string> = {
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
logger.error('Something went wrong', { error: err })
logger.debug('User data', { user })
\`\`\`

> The logger is a pre-configured singleton — import and use it directly with no additional setup required.`,

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

**Active level by environment**
- \`development\` → \`debug\` and above are logged
- \`production\` → \`warn\` and above are logged

**Passing metadata**
\`\`\`ts
logger.info('User created', { userId: 42, email: 'user@example.com' })
logger.error('DB connection failed', { error: err, retries: 3 })
\`\`\``,

    output: `## Log Output Structure

Logs are written in two destinations:

### File (daily rotated)
- Format: **JSON** with timestamp and stack trace on errors
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
  "message": "Unexpected failure",
  "stack": "Error: Unexpected failure\\n    at ...",
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
| Exit on error | \`false\` (process stays alive on handled exceptions) |
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
            format: format.combine(format.timestamp(), format.json())
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
    logger.error('Operation failed', { error })
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
            description: 'Get documentation for @qnx/winston — zero-config Winston logger that writes structured JSON to daily-rotating files. Use when you need persistent, production-grade file logging with automatic retention and archiving. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe(
                    'usage | levels | output | configuration | patterns | all'
                )
            }
        },
        async ({ topic }) => {
            let text: string

            if (topic === 'all') {
                text = [
                    '# `@qnx/winston` Reference\n',
                    docs.usage,
                    docs.levels,
                    docs.output,
                    docs.configuration,
                    docs.patterns
                ].join('\n\n---\n\n')
            } else {
                text = docs[topic]
            }

            return {
                content: [{ type: 'text', text }]
            }
        }
    )
}
