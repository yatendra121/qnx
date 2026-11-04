import express from 'express'
import { createMcpHttpHandler } from './lib/transport'

const app = express()
app.use(express.json())

const options = { authToken: process.env.MCP_AUTH_TOKEN }

app.all('/mcp',          createMcpHttpHandler(undefined, options))
app.all('/mcp/crypto',   createMcpHttpHandler({ crypto: true }, options))
app.all('/mcp/response', createMcpHttpHandler({ response: true }, options))
app.all('/mcp/errors',   createMcpHttpHandler({ errors: true }, options))
app.all('/mcp/client',   createMcpHttpHandler({ client: true }, options))
app.all('/mcp/winston',  createMcpHttpHandler({ winston: true }, options))
app.all('/mcp/log',      createMcpHttpHandler({ log: true }, options))

const port = process.env.PORT || 4000
app.listen(port, () => {
    console.log(`MCP server running at http://localhost:${port}/mcp`)
}).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use`)
    else console.error(err)
    process.exit(1)
})
