import { createMcpHttpApp } from './lib/app'

const app = createMcpHttpApp({ authToken: process.env.MCP_AUTH_TOKEN })

const port = process.env.PORT || 4000
app.listen(port, () => {
    console.log(`MCP server running at http://localhost:${port}/mcp`)
}).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use`)
    else console.error(err)
    process.exit(1)
})
