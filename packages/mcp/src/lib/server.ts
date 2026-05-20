import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerFormatErrorTool } from './tools/format-error.tool'
import { registerCreateErrorInstanceTool } from './tools/create-error-instance.tool'
import { registerLoggerDocsTool } from './tools/logger-docs.tool'
import { registerBuildLogEntryTool } from './tools/build-log-entry.tool'
import { registerConsoleLogDocsTool } from './tools/console-log-docs.tool'
import { registerBuildConsoleLogTool } from './tools/build-console-log.tool'
import { registerClientDocsTool } from './tools/client-docs.tool'
import { registerBuildClientResponseTool } from './tools/build-client-response.tool'
import { registerCryptoDocsTool } from './tools/crypto-docs.tool'
import { registerBuildCryptoSnippetTool } from './tools/build-crypto-snippet.tool'
import { registerListMcpToolsTool } from './tools/list-mcp-tools.tool'
import { registerTransformHandlerTool } from './tools/transform-handler.tool'
// import { registerLogMessageTool } from './tools/log-message.tool'
import { registerBuildApiResponseTool } from './tools/build-api-response.tool'
import { registerResponsePatternTool } from './tools/response-pattern.tool'

export interface McpServerConfig {
    crypto?: boolean
    response?: boolean
    log?: boolean
    winston?: boolean
    schema?: boolean
    errors?: boolean
    client?: boolean
}

const defaultConfig: McpServerConfig = {
    crypto: true,
    response: true,
    log: true,
    winston: true,
    schema: true,
    errors: true,
    client: true
}

export function createMcpServer(config: McpServerConfig = defaultConfig) {
    const server = new McpServer({
        name: 'qnx-mcp',
        version: '0.8.0'
    })

    registerListMcpToolsTool(server)

    if (config.crypto) {
        registerCryptoDocsTool(server)
        registerBuildCryptoSnippetTool(server)
    }

    if (config.response) {
        registerBuildApiResponseTool(server)
        registerResponsePatternTool(server)
        registerTransformHandlerTool(server)
    }

    if (config.winston) {
        registerLoggerDocsTool(server)
        registerBuildLogEntryTool(server)
    }

    if (config.log) {
        registerConsoleLogDocsTool(server)
        registerBuildConsoleLogTool(server)
    }

    if (config.errors) {
        registerFormatErrorTool(server)
        registerCreateErrorInstanceTool(server)
    }

    if (config.client) {
        registerClientDocsTool(server)
        registerBuildClientResponseTool(server)
    }

    return server
}
