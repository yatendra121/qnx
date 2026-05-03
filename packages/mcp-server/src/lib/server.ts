import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerExampleTool } from './tools/example.tool'
// import { registerGenerateAuthTokenTool } from './tools/generate-auth-token.tool'
// import { registerDecryptAuthTokenTool } from './tools/decrypt-auth-token.tool'
// import { registerInspectJwtPayloadTool } from './tools/inspect-jwt-payload.tool'
// import { registerValidateSchemaTool } from './tools/validate-schema.tool'
import { registerFormatErrorTool } from './tools/format-error.tool'
// import { registerLogMessageTool } from './tools/log-message.tool'
import { registerBuildApiResponseTool } from './tools/build-api-response.tool'
import { registerResponsePatternTool } from './tools/response-pattern.tool'

export interface McpServerConfig {
    crypto?: boolean
    response?: boolean
    log?: boolean
    schema?: boolean
    errors?: boolean
}

const defaultConfig: McpServerConfig = {
    crypto: true,
    response: true,
    log: true,
    schema: true,
    errors: true
}

export function createMcpServer(config: McpServerConfig = defaultConfig) {
    const server = new McpServer({
        name: 'qnx-mcp-server',
        version: '0.8.2'
    })

    registerExampleTool(server)

    // if (config.crypto) {
    //     registerGenerateAuthTokenTool(server)
    //     registerDecryptAuthTokenTool(server)
    //     registerInspectJwtPayloadTool(server)
    // }

    if (config.response) {
        registerBuildApiResponseTool(server)
        registerResponsePatternTool(server)
    }

    // if (config.log) {
    //     registerLogMessageTool(server)
    // }

    // if (config.schema) {
    //     registerValidateSchemaTool(server)
    // }

    if (config.errors) {
        registerFormatErrorTool(server)
    }

    return server
}
