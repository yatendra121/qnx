import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const patterns = ['callback-query', 'callback-try-catch', 'promise-chain', 'express-next'] as const

const migrations: Record<typeof patterns[number], { description: string; before: string; after: string }> = {
    'callback-query': {
        description: 'Route using a callback-based DB query (connection.query, pool.query). Migrate by promisifying the query or using an async DB client.',
        before: `router.get('/users', (req, res) => {
    connection.query('SELECT * FROM users', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ data: rows })
    })
})`,
        after: `import { asyncValidatorHandler } from '@qnx/response'

router.get('/users', asyncValidatorHandler(async (req) => {
    const rows = await db.query('SELECT * FROM users')
    return rows // auto-wrapped as { data: rows }
}))`,
    },
    'callback-try-catch': {
        description: 'Route using async/await with manual try/catch and res.status() calls. Remove the try/catch — asyncValidatorHandler catches all errors automatically.',
        before: `router.post('/users', async (req, res) => {
    try {
        const user = await User.create(req.body)
        res.status(201).json({ data: user, message: 'Created.' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})`,
        after: `import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

router.post('/users', asyncValidatorHandler(async (req) => {
    const user = await User.create(req.body)
    return initializeApiResponse().setData(user).setMessage('Created.')
    // errors thrown here are caught automatically — no try/catch needed
}))`,
    },
    'promise-chain': {
        description: 'Route using .then()/.catch() promise chains. Replace with async/await inside asyncValidatorHandler.',
        before: `router.get('/users/:id', (req, res) => {
    User.findById(req.params.id)
        .then(user => {
            if (!user) return res.status(404).json({ error: 'Not found' })
            res.json({ data: user })
        })
        .catch(err => res.status(500).json({ error: err.message }))
})`,
        after: `import { asyncValidatorHandler, throwInvalidValueApiResponse } from '@qnx/response'

router.get('/users/:id', asyncValidatorHandler(async (req) => {
    const user = await User.findById(req.params.id)
    if (!user) throwInvalidValueApiResponse('id', 'User not found.')
    return user // auto-wrapped as { data: user }
}))`,
    },
    'express-next': {
        description: 'Route that calls next(err) to forward errors to the Express error handler. asyncValidatorHandler handles errors inline — next() is no longer needed.',
        before: `router.put('/users/:id', async (req, res, next) => {
    try {
        const updated = await User.update(req.params.id, req.body)
        res.json({ data: updated })
    } catch (err) {
        next(err)
    }
})`,
        after: `import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

router.put('/users/:id', asyncValidatorHandler(async (req) => {
    const updated = await User.update(req.params.id, req.body)
    return initializeApiResponse().setData(updated).setMessage('Updated successfully.')
    // asyncValidatorHandler catches errors and sends the correct response — no next() needed
}))`,
    },
}

export function registerTransformHandlerTool(server: McpServer) {
    server.registerTool(
        'transform-to-async-handler',
        {
            description: 'Show a before/after migration from a callback-style Express route to asyncValidatorHandler (@qnx/response). Covers the four most common patterns: callback-query, callback-try-catch, promise-chain, express-next.',
            inputSchema: {
                pattern: z.enum(patterns).describe(
                    'callback-query | callback-try-catch | promise-chain | express-next'
                )
            }
        },
        async ({ pattern }) => {
            const { description, before, after } = migrations[pattern]
            return {
                content: [{
                    type: 'text',
                    text: `## Migrate: ${pattern}\n\n${description}\n\n### Before\n\`\`\`typescript\n${before}\n\`\`\`\n\n### After\n\`\`\`typescript\n${after}\n\`\`\``
                }]
            }
        }
    )
}
