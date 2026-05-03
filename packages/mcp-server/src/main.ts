import express from 'express'
import { createMcpHttpHandler } from './lib/transport'

const app = express()
app.use(express.json())


app.all('/mcp',          createMcpHttpHandler())
// app.all('/mcp/crypto',   createMcpHttpHandler({ crypto: true }))
app.all('/mcp/response', createMcpHttpHandler({ response: true }))
// app.all('/mcp/log',      createMcpHttpHandler({ log: true }))
// app.all('/mcp/schema',   createMcpHttpHandler({ schema: true }))
app.all('/mcp/errors',   createMcpHttpHandler({ errors: true }))

const port = process.env.PORT || 4000
app.listen(port, () => {
    console.log(`MCP server running at http://localhost:${port}`)
    console.log(`  /mcp          → all tools`)
    // console.log(`  /mcp/crypto   → generate-auth-token, decrypt-auth-token, inspect-jwt-payload`)
    console.log(`  /mcp/response → build-api-response`)
    // console.log(`  /mcp/log      → log-message`)
    // console.log(`  /mcp/schema   → validate-schema`)
    console.log(`  /mcp/errors   → format-error`)
}).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use`)
    else console.error(err)
    process.exit(1)
})
