import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { analyzeLegacyRoute, type LegacyPattern, legacyPatterns } from '../knowledge/legacy-routes'
import { readOnlyTool, textResult, toolError } from './shared'

interface BehaviorChange {
    aspect: string
    before: string
    after: string
    action: string
}

const LEAK_ACTION = 'Before production, use safeHandler from get-response-docs { "pattern": "server-error" }'

const migrations: Record<LegacyPattern, { description: string; before: string; after: string; changes: BehaviorChange[] }> = {
    'callback-query': {
        description: 'Route using a callback-based DB query (connection.query, pool.query). Migrate by promisifying the query or using an async DB client, such as mysql2/promise.',
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
        changes: [
            {
                aspect: 'DB error body',
                before: '500 `{ error: message }`',
                after: '500 `{ serverError: { name, message, stack } }`, so the stack trace now reaches the client',
                action: LEAK_ACTION
            }
        ]
    },
    'callback-try-catch': {
        description: 'Route using async/await with manual try/catch and res.status() calls. Remove the try/catch — asyncValidatorHandler catches all errors automatically. Keep any non-200 status with setStatusCode.',
        before: `router.post('/users', async (req, res) => {
    try {
        const user = await User.create(req.body)
        res.status(201).json({ data: user, message: 'Created.' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})`,
        after: `import { asyncValidatorHandler, ApiResponse } from '@qnx/response'

router.post('/users', asyncValidatorHandler(async (req) => {
    const user = await User.create(req.body)
    return ApiResponse.getInstance().setStatusCode(201).setData(user).setMessage('Created.')
    // errors thrown here are caught automatically — no try/catch needed
}))`,
        changes: [
            {
                aspect: 'Unexpected error body',
                before: '500 `{ error: message }`',
                after: '500 `{ serverError: { name, message, stack } }`, so the stack trace now reaches the client',
                action: LEAK_ACTION
            }
        ]
    },
    'promise-chain': {
        description: 'Route using .then()/.catch() promise chains. Replace with async/await inside asyncValidatorHandler. Throw ApiError for a status such as 404: InvalidValueError would change it to 400.',
        before: `router.get('/users/:id', (req, res) => {
    User.findById(req.params.id)
        .then(user => {
            if (!user) return res.status(404).json({ error: 'Not found' })
            res.json({ data: user })
        })
        .catch(err => res.status(500).json({ error: err.message }))
})`,
        after: `import { asyncValidatorHandler } from '@qnx/response'
import { ApiError } from '@qnx/errors'

router.get('/users/:id', asyncValidatorHandler(async (req) => {
    const user = await User.findById(req.params.id)
    if (!user) throw new ApiError('Not found', 404)
    return user // auto-wrapped as { data: user }
}))`,
        changes: [
            {
                aspect: '404 body',
                before: '`{ error: \'Not found\' }`',
                after: '`{ message: \'Not found\' }`',
                action: 'Update clients that read `error`, or use `ApiError` with field errors if they need it'
            },
            {
                aspect: 'Unexpected error body',
                before: '500 `{ error: message }`',
                after: '500 `{ serverError: { name, message, stack } }`, so the stack trace now reaches the client',
                action: LEAK_ACTION
            }
        ]
    },
    'express-next': {
        description: 'Route that calls next(err) to forward errors to the app\'s Express error handler. asyncValidatorHandler handles errors itself and never calls that handler, so keep next(err) if you rely on it for logging or sanitising errors.',
        before: `router.put('/users/:id', async (req, res, next) => {
    try {
        const updated = await User.update(req.params.id, req.body)
        res.json({ data: updated })
    } catch (err) {
        next(err)
    }
})`,
        after: `import { asyncValidatorHandler } from '@qnx/response'

router.put('/users/:id', asyncValidatorHandler(async (req, res, next) => {
    try {
        const updated = await User.update(req.params.id, req.body)
        return updated // auto-wrapped as { data: updated }
    } catch (err) {
        // Keeps your app's error handler in charge of the response
        next(err)
    }
}))`,
        changes: [
            {
                aspect: 'If you remove the try/catch',
                before: 'Errors go to your error handler, which controls the body',
                after: 'The handler is skipped, and the message and stack trace reach the client',
                action: 'Keep `next(err)` as shown, or use safeHandler from get-response-docs { "pattern": "server-error" }'
            },
            {
                aspect: '@qnx/errors thrown inside the try',
                before: 'Not applicable',
                after: 'They also go to your error handler, not to the standard response',
                action: 'Add `if (err instanceof ApiError) throw err` to the catch to send the standard response'
            }
        ]
    }
}

function renderChanges(changes: BehaviorChange[]) {
    const rows = changes.map(({ aspect, before, after, action }) => `| ${aspect} | ${before} | ${after} | ${action} |`)
    return `### Behaviour changes to check\n\n| What | Before | After | What to do |\n| --- | --- | --- | --- |\n${rows.join('\n')}`
}

function renderPattern(pattern: LegacyPattern) {
    const { description, before, after, changes } = migrations[pattern]
    return `## Migrate: ${pattern}\n\n${description}\n\n### Before\n\`\`\`typescript\n${before}\n\`\`\`\n\n### After\n\`\`\`typescript\n${after}\n\`\`\`\n\n${renderChanges(changes)}`
}

export function renderCodeAnalysis(code: string) {
    const { patterns, conversions, notes } = analyzeLegacyRoute(code)

    if (patterns.length === 0 && conversions.length === 0) {
        return undefined
    }

    const rows = conversions.map(({ line, original, becomes, note }) =>
        `| ${line} | \`${original.replace(/\|/g, '\\|')}\` | \`${becomes.replace(/\|/g, '\\|')}\` | ${note ?? ''} |`
    )

    return [
        '## Your code',
        `Detected: ${patterns.length > 0 ? patterns.map((pattern) => `\`${pattern}\``).join(', ') : 'direct `res` responses'}.`,
        'This is pattern matching on your source, not a parse, so check it against the code. Apply these conversions inside `asyncValidatorHandler(async (req, res, next) => { ... })`:',
        rows.length > 0
            ? `| Line | Your code | Becomes | Note |\n| --- | --- | --- | --- |\n${rows.join('\n')}`
            : 'No direct `res` responses were found to convert.',
        ...(notes.length > 0 ? ['### Check these', ...notes.map((note) => `- ${note}`)] : [])
    ].join('\n\n')
}

export function registerTransformHandlerTool(server: McpServer) {
    server.registerTool(
        'transform-to-async-handler',
        {
            ...readOnlyTool('Migrate a route to asyncValidatorHandler'),
            description: 'Migrate an Express route to asyncValidatorHandler (@qnx/response). Pass your route as `code` to get line-by-line conversions that keep its status codes, the patterns detected, and the behaviour changes to check. Or pass `pattern` for a tested before/after example: callback-query, callback-try-catch, promise-chain, express-next.',
            inputSchema: {
                pattern: z.enum(legacyPatterns).optional().describe(
                    'callback-query | callback-try-catch | promise-chain | express-next. Optional when code is given: detected automatically.'
                ),
                code: z.string().max(200_000).optional().describe(
                    'The source of the Express route or router file to migrate'
                )
            }
        },
        async ({ pattern, code }) => {
            if (!pattern && !code) {
                return toolError(`Error: pass "code" with your route, or "pattern" for an example (${legacyPatterns.join(', ')}).`)
            }

            const sections: string[] = []

            if (code) {
                const analysis = renderCodeAnalysis(code)
                sections.push(analysis ?? '## Your code\n\nNo Express route patterns were found: no `res.json`, `res.send`, `res.status`, `next(err)`, `.then()` or query callbacks. Check that this is the route you meant to migrate.')
            }

            const examples = pattern ? [pattern] : code ? analyzeLegacyRoute(code).patterns : []
            sections.push(...examples.map(renderPattern))

            return textResult(sections.join('\n\n---\n\n'))
        }
    )
}
