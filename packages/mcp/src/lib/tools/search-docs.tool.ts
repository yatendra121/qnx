import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchDocs } from '../knowledge/docs-index'
import type { McpServerConfig } from '../server'
import { readOnlyTool, textResult } from './shared'

export function registerSearchDocsTool(server: McpServer, config: McpServerConfig) {
    server.registerTool(
        'search-docs',
        {
            ...readOnlyTool('Search the docs'),
            description: 'Search all @qnx/* documentation, guides and known errors by free text, such as "session expiry", "log an error with its stack" or "change the validation status code". Returns the best matches with an excerpt and the tool call that returns the full section.',
            inputSchema: {
                query: z.string().min(1).describe('What you want to find, in plain words or an exact name'),
                limit: z.number().int().min(1).max(10).optional().describe('How many results to return. Defaults to 5.')
            }
        },
        async ({ query, limit }) => {
            const hits = searchDocs(query, config, limit)
            if (hits.length === 0) {
                return textResult(`No documentation matches "${query}". The @qnx/* packages are Node.js and TypeScript libraries, with no UI components or composables. Try other words, or see what exists with get-package-info { "package": "all" }.`)
            }
            return textResult(hits.map(({ package: packageName, title, source, excerpt }, index) =>
                `## ${index + 1}. ${title}\n\n**Package:** ${packageName}\n**Full section:** ${source}\n\n${excerpt}`
            ).join('\n\n---\n\n'))
        }
    )
}
