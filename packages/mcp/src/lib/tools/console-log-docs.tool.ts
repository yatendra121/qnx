import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readOnlyTool, textResult } from './shared'

const topics = ['usage', 'types', 'patterns', 'all'] as const

export const consoleLogDocs: Record<Exclude<typeof topics[number], 'all'>, string> = {
    usage: `## Usage

**Installation**
\`\`\`bash
npm install @qnx/log chalk
\`\`\`

**Import**
\`\`\`ts
import { consoleLog } from '@qnx/log'
\`\`\`

**Basic examples**
\`\`\`ts
consoleLog('Server started', { type: 'info' })
consoleLog('An error occurred!', { type: 'error' })
consoleLog('Operation successful', { type: 'success' })
consoleLog('Proceed with caution', { type: 'warn' })
\`\`\`

> The \`type\` option defaults to \`'info'\` if omitted:
\`\`\`ts
consoleLog('This is an informational message')
\`\`\``,

    types: `## Message Types

| Type | Color | When to use |
| --- | --- | --- |
| \`info\` | Blue | General informational messages (default) |
| \`success\` | Green | Successful operations |
| \`warn\` | Yellow | Warnings or things to be cautious about |
| \`warning\` | Yellow | Deprecated alias of \`warn\` |
| \`error\` | Red | Errors and failures |
| \`debug\` | Magenta | Development diagnostics |
| \`trace\` | Cyan | Detailed flow tracing |

**Signature**
\`\`\`ts
consoleLog(message: unknown, { type }: { type?: 'info' | 'success' | 'warn' | 'warning' | 'error' | 'debug' | 'trace' } = {}): void
\`\`\`

**What \`message\` can be**

| Value | Printed as |
| --- | --- |
| A string | The string |
| An \`Error\` | Its stack trace, dimmed, followed by each \`cause\` |
| An object | Indented JSON |
| Anything else | \`String(value)\` |

> Output is colorized in the terminal via [Chalk](https://www.npmjs.com/package/chalk). No file output — console only.`,

    patterns: `## Common Patterns

### Startup messages
\`\`\`ts
import { consoleLog } from '@qnx/log'

consoleLog('Server started on port 3000', { type: 'success' })
consoleLog('Connected to database', { type: 'success' })
consoleLog('Running in development mode', { type: 'warn' })
\`\`\`

### Script feedback
\`\`\`ts
consoleLog('Starting migration...', { type: 'info' })
consoleLog('Migration complete', { type: 'success' })
\`\`\`

### Error reporting
\`\`\`ts
try {
    await riskyOperation()
    consoleLog('Operation completed', { type: 'success' })
} catch (err) {
    // Passing the Error prints its stack trace and cause chain
    consoleLog(err, { type: 'error' })
}
\`\`\`

### When to use @qnx/log vs @qnx/winston
| Scenario | Use |
| --- | --- |
| Development feedback, CLI scripts, startup messages | \`@qnx/log\` |
| Production logging, persistent records, file rotation | \`@qnx/winston\` |`
}

export function registerConsoleLogDocsTool(server: McpServer) {
    server.registerTool(
        'get-console-log-docs',
        {
            ...readOnlyTool('@qnx/log docs'),
            description: 'Get documentation for @qnx/log — lightweight colorized terminal output for development, CLI scripts, and startup messages. Use instead of @qnx/winston when you need visible terminal feedback without file persistence. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe('usage | types | patterns | all')
            }
        },
        async ({ topic }) => textResult(
            topic === 'all'
                ? ['# `@qnx/log` Reference\n', ...Object.values(consoleLogDocs)].join('\n\n---\n\n')
                : consoleLogDocs[topic]
        )
    )
}
