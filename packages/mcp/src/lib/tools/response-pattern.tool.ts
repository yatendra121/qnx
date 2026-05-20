import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const patterns = [
    'async-handler',
    'success',
    'validation-error',
    'invalid-value',
    'throw-validation',
    'zod-validation',
    'unauthenticated',
    'resource-route'
] as const

const examples: Record<typeof patterns[number], { description: string; code: string }> = {
    'async-handler': {
        description: 'Wrap any Express route with asyncValidatorHandler. It catches ValidationError, UnauthenticatedUserError, ZodError, and generic Error automatically and sends the correct response.',
        code: `// BEFORE: callback-style with manual error handling
router.get('/users', (req, res) => {
    connection.query('SELECT * FROM users', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ data: rows })
    })
})

router.post('/users', async (req, res) => {
    try {
        const user = await User.create(req.body)
        res.status(201).json({ data: user, message: 'Created.' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// AFTER: asyncValidatorHandler — return data, throw errors, no res.json() needed
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

router.get('/users', asyncValidatorHandler(async (req) => {
    const rows = await db.query('SELECT * FROM users')
    return rows // auto-wrapped as { data: rows }
}))

router.post('/users', asyncValidatorHandler(async (req) => {
    const user = await User.create(req.body)
    return initializeApiResponse().setData(user).setMessage('Created.')
    // errors thrown here are caught automatically — no try/catch needed
}))`,
    },
    'success': {
        description: 'Return a success response (HTTP 200). Raw return values are auto-wrapped in { data: ... }. Use initializeApiResponse() to include a message or control the shape.',
        code: `import { initializeApiResponse, ApiResponse } from '@qnx/response'

// Raw object → { data: { id: 1, name: 'Item' } }
return { id: 1, name: 'Item' }

// With message → { data: { id: 1 }, message: 'Created.' }
return initializeApiResponse().setData({ id: 1 }).setMessage('Created.')

// Custom status code
return ApiResponse.getInstance().setStatusCode(201).setData(item)

// Additional fields → { data: { id: 1 }, meta: { total: 10 } }
return ApiResponse.getInstance()
    .setData({ id: 1 })
    .setAdditional({ meta: { total: 10 } })`,
    },
    'validation-error': {
        description: 'Return a validation error with multiple field errors. Status: VALIDATION_ERROR_CODE (default 400). Body: { errors: { field: [msg] }, error: firstMsg }',
        code: `import { invalidApiResponse, ApiResponseErrorsValue } from '@qnx/response'

const errors = ApiResponseErrorsValue.getInstance()
    .addError('email', 'Email is required.')
    .addError('name', 'Name must be at least 2 characters.')
    .getErrors()

return invalidApiResponse(res, errors)
// → { errors: { email: ['Email is required.'], name: ['Name must be...'] }, error: 'Email is required.' }`,
    },
    'invalid-value': {
        description: 'Return a single-field validation error. Status: VALIDATION_ERROR_CODE (default 400). Body: { errors: { field: [msg] }, error: msg }',
        code: `import { invalidValueApiResponse } from '@qnx/response'

return invalidValueApiResponse(res, 'email', 'Email is required.')
// → { errors: { email: ['Email is required.'] }, error: 'Email is required.' }`,
    },
    'throw-validation': {
        description: 'Throw a validation error from anywhere inside asyncValidatorHandler — it is caught and the correct error response is sent automatically.',
        code: `import { throwInvalidValueApiResponse } from '@qnx/response'
import { ValidationError, InvalidValueError } from '@qnx/errors'
import { ApiResponseErrorsValue } from '@qnx/response'

// Single field shorthand
throwInvalidValueApiResponse('email', 'Email is required.')

// Single field via error class
throw new InvalidValueError('Email is required.', { key: 'email' })

// Multiple fields
const errors = ApiResponseErrorsValue.getInstance()
    .addError('email', 'Email is required.')
    .addError('name', 'Name is required.')
    .getErrors()
throw new ValidationError('Validation failed', { errRes: { errors } })`,
    },
    'zod-validation': {
        description: 'Use Zod schema parsing inside asyncValidatorHandler. ZodErrors are caught automatically and converted to { errors: { "field.path": [msg] }, error: firstMsg }. Nested paths use dot notation.',
        code: `import z from 'zod'
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

const UserSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    addresses: z.array(z.string())
})

router.post('/users', asyncValidatorHandler(async (req) => {
    const data = UserSchema.parse(req.body) // ZodError auto-caught → { errors: { email: [...] }, error: '...' }
    return initializeApiResponse().setData(data).setMessage('User created successfully.')
}))
// Nested errors use dot notation: 'addresses.1', 'posts.0.tagUsers.2'`,
    },
    'unauthenticated': {
        description: 'Return an unauthenticated response. Status: UNAUTHENTICATED_USER_ERROR_CODE (default 500). Body: { errorCode: "unauthenticated", message: "Unauthenticated" }',
        code: `import { unauthenticateApiResponse } from '@qnx/response'
import { UnauthenticatedUserError } from '@qnx/errors'

// Direct response
return unauthenticateApiResponse(res)

// Or throw — asyncValidatorHandler catches UnauthenticatedUserError automatically
throw new UnauthenticatedUserError('Not authenticated')`,
    },
    'resource-route': {
        description: 'Register standard CRUD routes on an Express router. Each provided method is wrapped in asyncValidatorHandler automatically. Routes: GET /, GET /:id, POST /, PUT /:id, PUT /change-status/:id, DELETE /:id',
        code: `import { resourceRoute, initializeApiResponse } from '@qnx/response'
import { Router } from 'express'

const router = Router()

resourceRoute(router, {
    findAll:      async (req) => items,                                              // GET    /
    findOne:      async (req) => item,                                               // GET    /:id
    create:       async (req) => initializeApiResponse()                             // POST   /
                      .setData(newItem).setMessage('Created successfully.'),
    update:       async (req) => initializeApiResponse()                             // PUT    /:id
                      .setData(updated).setMessage('Updated successfully.'),
    changeStatus: async (req) => initializeApiResponse()                             // PUT    /change-status/:id
                      .setMessage('Status updated.'),
    remove:       async (req) => initializeApiResponse().setMessage('Deleted.')      // DELETE /:id
})`,
    },
}

export function registerResponsePatternTool(server: McpServer) {
    server.registerTool(
        'get-response-docs',
        {
            description: 'Get documentation for @qnx/response — Express handler utilities that standardize HTTP response shapes. asyncValidatorHandler auto-catches @qnx/errors and ZodErrors; initializeApiResponse controls the success response body. Use this to understand the full response pattern.',
            inputSchema: {
                pattern: z.enum(patterns).describe(
                    'async-handler | success | validation-error | invalid-value | throw-validation | zod-validation | unauthenticated | resource-route'
                )
            }
        },
        async ({ pattern }) => {
            const { description, code } = examples[pattern]
            return {
                content: [{
                    type: 'text',
                    text: `## ${pattern}\n\n${description}\n\n\`\`\`typescript\n${code}\n\`\`\``
                }]
            }
        }
    )
}
