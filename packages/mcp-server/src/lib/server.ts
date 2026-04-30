import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
    registerExampleTool,
    registerGenerateAuthTokenTool,
    registerDecryptAuthTokenTool,
    registerValidateSchemaTool,
    registerFormatErrorTool,
    registerLogMessageTool,
    registerBuildApiResponseTool
} from './tools'

export function createMcpServer() {
    const server = new McpServer({
        name: 'qnx-mcp-server',
        version: '0.8.2'
    })

    registerExampleTool(server)
    registerGenerateAuthTokenTool(server)
    registerDecryptAuthTokenTool(server)
    registerValidateSchemaTool(server)
    registerFormatErrorTool(server)
    registerLogMessageTool(server)
    registerBuildApiResponseTool(server)

    return server
}
