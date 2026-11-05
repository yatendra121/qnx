import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { reviewCode } from '../knowledge/review-rules'
import type { McpServerConfig } from '../server'
import { jsonResult, readOnlyTool } from './shared'

export function registerReviewCodeTool(server: McpServer, config: McpServerConfig) {
    server.registerTool(
        'review-code',
        {
            ...readOnlyTool('Review code using @qnx packages'),
            description: 'Check source that uses the @qnx/* packages for known mistakes, with line numbers and fixes. Finds handlers that return nothing (HTML 404), errors that leak stack traces to clients, client checks that treat failures as successes, logger calls that lose errors, and crypto calls that throw or never expire. It uses pattern matching, not a parser, and only knows @qnx/* rules, so treat findings as prompts to check and an empty result as no known mistakes, not as proof the code is correct.',
            inputSchema: {
                code: z.string().min(1).max(200_000).describe('The source code to check: a file or snippet, in TypeScript or JavaScript')
            }
        },
        async ({ code }) => {
            const findings = reviewCode(code, config)
            return jsonResult({
                summary: findings.length === 0
                    ? 'No known @qnx/* mistakes found. This doesn\'t cover general bugs.'
                    : `${findings.length} finding${findings.length === 1 ? '' : 's'}.`,
                findings,
                limits: 'Pattern matching on source text: it can miss problems split across files, and can flag code that is fine in context. Each rule reports at most its first 200 matches.'
            })
        }
    )
}
