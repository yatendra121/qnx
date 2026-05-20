import express from 'express'
import { createMcpHttpHandler } from './lib/transport'

const app = express()
app.use(express.json())

app.all('/mcp',          createMcpHttpHandler())
app.all('/mcp/crypto',   createMcpHttpHandler({ crypto: true }))
app.all('/mcp/response', createMcpHttpHandler({ response: true }))
app.all('/mcp/errors',   createMcpHttpHandler({ errors: true }))
app.all('/mcp/client',   createMcpHttpHandler({ client: true }))
app.all('/mcp/winston',  createMcpHttpHandler({ winston: true }))
app.all('/mcp/log',      createMcpHttpHandler({ log: true }))

const port = process.env.PORT || 4000
app.listen(port, () => {
    console.log(`MCP server running at http://localhost:${port}/mcp`)
}).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use`)
    else console.error(err)
    process.exit(1)
})
