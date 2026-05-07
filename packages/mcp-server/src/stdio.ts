import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer, McpServerConfig } from './lib/server'

const lib = process.argv[2] as keyof McpServerConfig | undefined
const config: McpServerConfig | undefined = lib ? { [lib]: true } : undefined
const server = createMcpServer(config)
const transport = new StdioServerTransport()
server.connect(transport).catch(console.error)
