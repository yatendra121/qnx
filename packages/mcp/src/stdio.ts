import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer, McpServerConfig, packageScopes } from './lib/server'

const scope = process.argv[2]

if (scope && !packageScopes.includes(scope as keyof McpServerConfig)) {
    // stdout carries the protocol, so this goes to stderr.
    console.error(`Unknown package "${scope}". Use one of: ${packageScopes.join(', ')}, or none for all packages.`)
    process.exit(1)
}

const config: McpServerConfig | undefined = scope ? { [scope]: true } : undefined
const server = createMcpServer(config)
const transport = new StdioServerTransport()
server.connect(transport).catch(console.error)
