import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchDocs } from '../knowledge/docs-index'
import { knownErrors, peerInstallCommand, type KnownError } from '../knowledge/known-errors'
import type { McpServerConfig } from '../server'
import { readOnlyTool, textResult } from './shared'

const MAX_ERROR_LENGTH = 20_000

function renderMatch(known: KnownError, error: string) {
    const code = known.id === 'peer-dependency-missing' ? peerInstallCommand(error) : known.code
    return [
        `## ${known.title}`,
        known.package === 'mcp' ? undefined : `**Package:** \`@qnx/${known.package}\``,
        `**Cause:** ${known.cause}`,
        `**Fix:** ${known.fix}`,
        code ? `\`\`\`\n${code}\n\`\`\`` : undefined,
        known.docs ? `**More:** ${known.docs}` : undefined
    ].filter(Boolean).join('\n\n')
}

/** Used by the tool and by tests. Errors for packages outside this server's scope are left out. */
export function matchKnownErrors(error: string, config: McpServerConfig) {
    return knownErrors.filter((known) =>
        (known.package === 'mcp' || config[known.package]) &&
        known.patterns.some((pattern) => pattern.test(error))
    )
}

export function registerDiagnoseErrorTool(server: McpServer, config: McpServerConfig) {
    server.registerTool(
        'diagnose-error',
        {
            ...readOnlyTool('Diagnose an error'),
            description: 'Find the cause and fix for an error from code using the @qnx/* packages. Pass the error message or stack trace, a TypeScript error, or a surprising response body or log line. It matches against known errors, and says so when there is no match rather than guessing. Use this first when something fails.',
            inputSchema: {
                error: z.string().min(1).describe('The error message or stack trace, TS error, install error, or response body. Include the exact text.')
            }
        },
        async ({ error }) => {
            const text = error.slice(0, MAX_ERROR_LENGTH)
            const matches = matchKnownErrors(text, config)

            if (matches.length > 0) {
                return textResult(matches.map((known) => renderMatch(known, text)).join('\n\n---\n\n'))
            }

            const related = searchDocs(text.split('\n')[0].slice(0, 300), config, 3)
            return textResult([
                '## No known match',
                'This isn\'t one of the errors this server recognises, so it may not come from the @qnx/* packages.',
                related.length > 0
                    ? `Possibly related docs:\n\n${related.map(({ title, source }) => `- ${title}: ${source}`).join('\n')}`
                    : 'No related docs were found either.'
            ].join('\n\n'))
        }
    )
}
