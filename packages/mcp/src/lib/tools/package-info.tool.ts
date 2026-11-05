import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { packages, renderCatalogue, renderPackage } from '../knowledge/packages'
import { readOnlyTool, textResult } from './shared'

const packageNames = packages.map(({ name }) => name)

export function registerPackageInfoTool(server: McpServer) {
    server.registerTool(
        'get-package-info',
        {
            ...readOnlyTool('Package overview'),
            description: 'See which @qnx/* packages exist and what each one does. For one package, get its install command, peer dependencies and every public export with its signature. @qnx/core-helpers, @qnx/interfaces and @qnx/message are fully documented here. Use "all" to choose a package.',
            inputSchema: {
                package: z.enum(['all', ...packageNames] as [string, ...string[]]).describe(`all | ${packageNames.join(' | ')}`)
            }
        },
        async ({ package: name }) => textResult(
            name === 'all'
                ? renderCatalogue()
                : renderPackage(packages.find((info) => info.name === name) as typeof packages[number])
        )
    )
}
