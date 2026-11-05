import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import packageJson from '../../../package.json'
import type { McpServerConfig } from '../server'
import { readOnlyTool, textResult } from './shared'

type ToolRow = [name: string, purpose: string]

const generalTools: ToolRow[] = [
    ['diagnose-error', 'You have an error message, stack trace or surprising response: get its cause and fix'],
    ['search-docs', 'You have a question: free-text search across docs, guides and known errors'],
    ['review-code', 'You have code: check it for known mistakes, with line numbers and fixes'],
    ['get-guide', 'You are building a feature: tested end-to-end guides, and a production checklist'],
    ['get-package-info', 'You are choosing or installing a package: what exists, install commands, and every public export']
]

const packageTools: Record<string, { title: string; tools: ToolRow[] }> = {
    errors: {
        title: '`@qnx/errors`',
        tools: [
            ['get-error-class-docs', 'Constructor signature, methods, examples, and what each error class sends to the client'],
            ['build-api-error', 'Instantiate a real error class: see its code, errorResponse and HTTP response']
        ]
    },
    response: {
        title: '`@qnx/response`',
        tools: [
            ['get-response-docs', 'Handler setup, return values, success, validation, Zod, server errors, resource routes, API reference'],
            ['build-api-response', 'Run the real code: see the HTTP status, response body, and the function that produces it'],
            ['transform-to-async-handler', 'Migrate your Express route to asyncValidatorHandler, keeping its status codes']
        ]
    },
    client: {
        title: '`@qnx/client`',
        tools: [
            ['get-client-docs', 'Detecting failures reliably, response classes, TypeScript types, and usage patterns'],
            ['build-client-response', 'See what each getter returns for your values']
        ]
    },
    crypto: {
        title: '`@qnx/crypto`',
        tools: [
            ['get-crypto-docs', 'Key setup, JWT, JWE, auth tokens, key helpers, algorithms, and troubleshooting'],
            ['build-crypto-snippet', 'Generate a checked snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt']
        ]
    },
    winston: {
        title: '`@qnx/winston` (file logger)',
        tools: [
            ['get-file-logger-docs', 'Usage, levels, logging errors, file output format, configuration, and patterns'],
            ['build-file-log-entry', 'Preview the JSON a logger call writes to the file']
        ]
    },
    log: {
        title: '`@qnx/log` (console logger)',
        tools: [
            ['get-console-log-docs', 'Usage, message types (info/success/warn/error/debug/trace), and patterns'],
            ['build-console-log', 'Preview console output and get the consoleLog() call']
        ]
    }
}

const table = (rows: ToolRow[]) => [
    '| Tool | Use it for |',
    '| --- | --- |',
    ...rows.map(([name, purpose]) => `| \`${name}\` | ${purpose} |`)
].join('\n')

/** Lists only what this server exposes, so a scoped endpoint doesn't advertise tools it doesn't have. */
function toolsReference(config: McpServerConfig) {
    const packages = Object.entries(packageTools).filter(([name]) => config[name as keyof McpServerConfig])
    return [
        '# QNX MCP Server — Available Tools',
        `Covers the \`@qnx/*\` Node.js and TypeScript packages, not the QNX operating system. Docs match release ${packageJson.version}. Release notes: https://github.com/yatendra121/qnx/releases`,
        `## Start here\n\n${table(generalTools)}`,
        ...packages.map(([, { title, tools }]) => `## ${title}\n\n${table(tools)}`)
    ].join('\n\n')
}

export function registerListMcpToolsTool(server: McpServer, config: McpServerConfig) {
    server.registerTool(
        'list-mcp-tools',
        {
            ...readOnlyTool('List tools by task'),
            description: 'List the available QNX MCP tools by the task each one is for and by package. Useful for choosing a tool when working with any @qnx/* package.'
        },
        async () => textResult(toolsReference(config))
    )
}
