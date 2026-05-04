import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const topics = ['usage', 'types', 'patterns', 'all'] as const

const docs: Record<Exclude<typeof topics[number], 'all'>, string> = {
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
consoleLog('Proceed with caution', { type: 'warning' })
\`\`\`

> The \`type\` option defaults to \`'info'\` if omitted:
\`\`\`ts
consoleLog('This is an informational message')
\`\`\``,

    types: `## Message Types

| Type | Color | When to use |
| --- | --- | --- |
| \`info\` | Cyan | General informational messages (default) |
| \`error\` | Red | Errors and failures |
| \`success\` | Green | Successful operations |
| \`warning\` | Yellow | Warnings or things to be cautious about |

**Signature**
\`\`\`ts
consoleLog(message: string, { type }: { type: 'info' | 'error' | 'success' | 'warning' } = { type: 'info' }): void
\`\`\`

> Output is colorized in the terminal via [Chalk](https://www.npmjs.com/package/chalk). No file output — console only.`,

    patterns: `## Common Patterns

### Startup messages
\`\`\`ts
import { consoleLog } from '@qnx/log'

consoleLog('Server started on port 3000', { type: 'success' })
consoleLog('Connected to database', { type: 'success' })
consoleLog('Running in development mode', { type: 'warning' })
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
    consoleLog(\`Operation failed: \${err.message}\`, { type: 'error' })
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
            description: 'Get documentation for @qnx/log — a colorized console logger using Chalk with four message types: info, error, success, warning. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe('usage | types | patterns | all')
            }
        },
        async ({ topic }) => {
            let text: string

            if (topic === 'all') {
                text = [
                    '# `@qnx/log` Reference\n',
                    docs.usage,
                    docs.types,
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
