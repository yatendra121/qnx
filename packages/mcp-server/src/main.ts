import express from 'express'
import { mcpHttpHandler } from './lib'

const app = express()
app.use(express.json())
app.all('/mcp', mcpHttpHandler)

const port = process.env.PORT || 4000
app.listen(port, () => {
    console.log(`MCP server running at http://localhost:${port}/mcp`)
})
