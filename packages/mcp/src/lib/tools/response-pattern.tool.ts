import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { errorCodes } from '@qnx/errors'
import { z } from 'zod'
import { readOnlyTool, textResult } from './shared'

const patterns = [
    'install',
    'async-handler',
    'handler-return-values',
    'success',
    'validation-error',
    'invalid-value',
    'custom-error',
    'throw-validation',
    'zod-validation',
    'unauthenticated',
    'server-error',
    'resource-route',
    'api-reference',
    'all'
] as const

type Pattern = Exclude<typeof patterns[number], 'all'>

const examples: Record<Pattern, { description: string; code: string; language?: string }> = {
    'install': {
        description: 'Express 4 or 5, zod 4 and @qnx/errors 0.8.8 or later are peer dependencies. Installing alongside zod 3 fails with ERESOLVE.',
        language: 'bash',
        code: `npm install @qnx/response @qnx/errors express zod@4`
    },
    'async-handler': {
        description: 'Wrap any Express route with asyncValidatorHandler. Return a value to respond, or throw to send an error. It catches @qnx/errors classes, ZodError and any other error, and sends the matching response. See handler-return-values for what each return does, and server-error before shipping: unexpected errors reach the client with their stack trace.',
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
import { asyncValidatorHandler, ApiResponse } from '@qnx/response'

router.get('/users', asyncValidatorHandler(async (req) => {
    const rows = await db.query('SELECT * FROM users')
    return rows // auto-wrapped as { data: rows }
}))

router.post('/users', asyncValidatorHandler(async (req) => {
    const user = await User.create(req.body)
    // The default status is 200, so a create has to ask for 201
    return ApiResponse.getInstance().setStatusCode(201).setData(user).setMessage('Created.')
    // errors thrown here are caught automatically — no try/catch needed
}))`
    },
    'handler-return-values': {
        description: `What asyncValidatorHandler does with the value your function returns:

| Your function | Result |
| --- | --- |
| Returns an \`ApiResponse\` | Sends it |
| Returns any other value, including \`null\`, \`0\` or \`''\` | 200 \`{ data: value }\` |
| Returns the result of \`res.json(...)\` or an \`*ApiResponse(res)\` call | Already sent, nothing more happens |
| Returns nothing or \`undefined\` | Calls \`next()\`, and if no later route matches, Express sends an **HTML 404** |

The last row is the usual cause of a \`DELETE\` or side-effect-only route returning 404 ("Cannot DELETE /items/1"), even though the work was done. Always return something.`,
        code: `import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

// ❌ Does the work, then responds with an HTML 404
router.delete('/items/:id', asyncValidatorHandler(async (req) => {
    await Item.delete(req.params.id)
}))

// ✅ Responds 200 { message: 'Deleted.' }
router.delete('/items/:id', asyncValidatorHandler(async (req) => {
    await Item.delete(req.params.id)
    return initializeApiResponse().setMessage('Deleted.')
}))

// ✅ Returning nothing is right for middleware that continues to the next handler
router.use(asyncValidatorHandler(async (req) => {
    req.user = await loadUser(req)
}))`
    },
    'success': {
        description: 'Return a success response (HTTP 200). Raw return values are auto-wrapped in { data: ... }. Use initializeApiResponse() to include a message or control the shape.',
        code: `import { initializeApiResponse, ApiResponse } from '@qnx/response'

// Raw object → { data: { id: 1, name: 'Item' } }
return { id: 1, name: 'Item' }

// With message → { data: { id: 1 }, message: 'Created.' }
return initializeApiResponse().setData({ id: 1 }).setMessage('Created.')

// Message only → { message: 'Deleted.' }. Clients must not treat a missing "data" as a failure.
return initializeApiResponse().setMessage('Deleted.')

// Custom status code
return ApiResponse.getInstance().setStatusCode(201).setData(item)

// Additional fields → { meta: { total: 10 }, data: { id: 1 } }
return ApiResponse.getInstance()
    .setData({ id: 1 })
    .setAdditional({ meta: { total: 10 } })`
    },
    'validation-error': {
        description: 'Throw a multi-field validation error from inside asyncValidatorHandler. Status: VALIDATION_ERROR_CODE (default 400). Body: { errors: { field: [msg] }, error: firstMsg }. Recommended: throw ValidationError — works from anywhere in the call stack, not just route handlers. Its own message never reaches the client.',
        code: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { ApiResponseErrorsValue, ValidationError } from '@qnx/errors'

const errors = ApiResponseErrorsValue.getInstance()
    .addError('email', 'Email is required.')
    .addError('name', 'Name must be at least 2 characters.')
    .getErrors()
throw new ValidationError('Validation failed', { errRes: { errors } })
// → { errors: { email: ['Email is required.'], name: ['Name must be...'] }, error: 'Email is required.' }

// Escape hatch — only for code outside asyncValidatorHandler (requires res)
import { invalidApiResponse } from '@qnx/response'
return invalidApiResponse(res, errors)`
    },
    'invalid-value': {
        description: 'Throw a single-field validation error from inside asyncValidatorHandler. Status: VALIDATION_ERROR_CODE (default 400). Body: { errors: { field: [msg] }, error: msg }. Recommended: throw InvalidValueError — works from anywhere in the call stack, not just route handlers.',
        code: `// ✅ Recommended — throw from anywhere inside asyncValidatorHandler
import { InvalidValueError } from '@qnx/errors'

throw new InvalidValueError('Email is required.', { key: 'email' })
// → { errors: { email: ['Email is required.'] }, error: 'Email is required.' }

// ⚠️ Deprecated — throwInvalidValueApiResponse and invalidValueApiResponse
// produce the same response; use InvalidValueError instead.`
    },
    'custom-error': {
        description: 'Throw an error with a custom HTTP status code, such as 404 or 409, from inside asyncValidatorHandler. ApiError responds with the given status and { message }; pass errRes to also include field errors. The status must be between 100 and 999, or Express throws and the request falls through to your app\'s error handler.',
        code: `import { ApiError } from '@qnx/errors'

// Custom status code → 404 { message: 'User not found.' }
throw new ApiError('User not found.', 404)

// With field errors → 409 { errors: { email: [...] }, error: 'Email already exists.', message: 'Conflict detected.' }
throw new ApiError('Conflict detected.', 409, {
    errRes: { errors: { email: ['Email already exists.'] } }
})`
    },
    'throw-validation': {
        description: 'Quick reference: which error class to throw for each case inside asyncValidatorHandler.',
        code: `import { ApiResponseErrorsValue, InvalidValueError, ValidationError } from '@qnx/errors'

// ✅ Single field — use InvalidValueError
throw new InvalidValueError('Email is required.', { key: 'email' })
// → getErrorResponse() = { errors: { email: ['Email is required.'] } }

// ✅ Multiple fields — use ValidationError
const errors = ApiResponseErrorsValue.getInstance()
    .addError('email', 'Email is required.')
    .addError('name', 'Name is required.')
    .getErrors()
throw new ValidationError('Validation failed', { errRes: { errors } })
// → getErrorResponse() = { errors: { email: [...], name: [...] } }

// ⚠️ Use addError to collect errors. setError replaces everything collected so far,
// including other fields, so two setError calls keep only the last one.

// ⚠️  throwInvalidValueApiResponse is deprecated — throw new InvalidValueError instead`
    },
    'zod-validation': {
        description: 'Use Zod schema parsing inside asyncValidatorHandler. ZodErrors are caught automatically and converted to { errors: { "field.path": [msg] }, error: firstMsg }. Nested paths use dot notation. A failure on the whole value, such as a missing request body, uses the key "". Requires zod 4 and a JSON body parser such as express.json().',
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
// Nested errors use dot notation: 'addresses.1', 'posts.0.tagUsers.2'
// "expected object, received undefined" means req.body is empty: the client sent no
// Content-Type: application/json header, or express.json() isn't installed.`
    },
    'unauthenticated': {
        description: `Return an unauthenticated response. Status: UNAUTHENTICATED_USER_ERROR_CODE (default ${errorCodes.UNAUTHENTICATED_USER_ERROR_CODE}). Body: always { errorCode: "unauthenticated", message: "Unauthenticated" }. The message you pass to UnauthenticatedUserError isn't sent to the client.`,
        code: `import { unauthenticateApiResponse } from '@qnx/response'
import { UnauthenticatedUserError } from '@qnx/errors'

// Direct response
return unauthenticateApiResponse(res)

// Or throw — asyncValidatorHandler catches UnauthenticatedUserError automatically.
// 'Not authenticated' is only visible in your own code and logs.
throw new UnauthenticatedUserError('Not authenticated')`
    },
    'server-error': {
        description: `**Unexpected errors reach the client.** Any error that isn't a @qnx/errors class or a ZodError is sent with its message and full stack trace, including file paths, in every environment. It can't be turned off. Handle this before going to production.

| You throw | Status | Body | \`setCallback\` logger called |
| --- | --- | --- | --- |
| \`new Error('...')\`, or any other unknown value | ${errorCodes.SERVER_ERROR_CODE} | \`{ serverError: { name, message, stack } }\` | Yes |
| \`new ServerError('Safe text')\` | ${errorCodes.SERVER_ERROR_CODE} | \`{ message: 'Safe text' }\` | No, log it yourself |
| \`new ApiError('Safe text', 503)\` | 503 | \`{ message: 'Safe text' }\` | No, log it yourself |

Use \`setCallback\` once at startup to log unexpected errors. To stop them reaching clients, wrap your routes as below: errors written for the client pass through, and anything else is logged and replaced with a generic 500.`,
        code: `import { asyncValidatorHandler, setCallback } from '@qnx/response'
import { ApiError, ServerError } from '@qnx/errors'
import { logger } from '@qnx/winston'
import { ZodError } from 'zod'
import type { NextFunction, Request, Response } from 'express'

// Logging only: the client still receives the stack trace
setCallback({
    logger: {
        serverError: (error) => {
            logger.error('Unhandled route error', error)
        }
    }
})

// Keeps details on the server. Use it in place of asyncValidatorHandler.
type Route = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export const safeHandler = (route: Route) =>
    asyncValidatorHandler(async (req, res, next) => {
        try {
            return await route(req, res, next)
        } catch (err) {
            if (err instanceof ApiError || err instanceof ZodError) throw err
            logger.error('Unhandled route error', err as Error)
            throw new ServerError('Internal server error')
        }
    })`
    },
    'resource-route': {
        description: 'Register standard CRUD routes on an Express router. Each provided method is wrapped in asyncValidatorHandler automatically, so the same return rules apply: a method that returns nothing responds with an HTML 404. Routes: GET /, GET /:id, POST /, PUT /:id, PUT /change-status/:id, DELETE /:id. Create responds 200 unless you ask for 201.',
        code: `import { resourceRoute, initializeApiResponse, ApiResponse } from '@qnx/response'
import { Router } from 'express'

const router = Router()

resourceRoute(router, {
    findAll:      async (req) => items,                                              // GET    /
    findOne:      async (req) => item,                                               // GET    /:id
    create:       async (req) => ApiResponse.getInstance().setStatusCode(201)        // POST   /
                      .setData(newItem).setMessage('Created successfully.'),
    update:       async (req) => initializeApiResponse()                             // PUT    /:id
                      .setData(updated).setMessage('Updated successfully.'),
    changeStatus: async (req) => initializeApiResponse()                             // PUT    /change-status/:id
                      .setMessage('Status updated.'),
    remove:       async (req) => initializeApiResponse().setMessage('Deleted.')      // DELETE /:id
})`
    },
    'api-reference': {
        description: `Everything \`@qnx/response\` exports.

| Export | Purpose |
| --- | --- |
| \`asyncValidatorHandler(fn)\` | Wraps a route: see handler-return-values |
| \`resourceRoute(router, controller)\` | Registers CRUD routes: see resource-route |
| \`initializeApiResponse()\` / \`ApiResponse.getInstance()\` | Starts a response |
| \`setCallback({ logger })\` | Registers \`logger.serverError(error)\`, called for unexpected errors only |
| \`errorApiResponse(res, error)\` | Sends the response for any error, the way the handler does. Use it in plain Express code or error middleware |
| \`invalidApiResponse(res, errors, statusCode?)\` | Sends a validation response without throwing |
| \`unauthenticateApiResponse(res)\` | Sends the 401 response |
| \`serverErrorApiResponse(res, error)\` | Sends 500 with \`serverError\`, including the stack, and doesn't call \`setCallback\` |
| \`invalidValueApiResponse(res, key, message)\` | Deprecated: throw \`InvalidValueError\` |
| \`throwInvalidValueApiResponse(key, message)\` | Deprecated: throw \`InvalidValueError\` |
| \`ApiResponseErrorsValue\` | Deprecated copy: import it from \`@qnx/errors\` |
| \`callbackObj\` | The current \`setCallback\` value. Internal |
| \`errorFormatter({ msg })\` | Returns \`[msg]\`. Kept for express-validator style formatters |

**\`ApiResponse\` methods** (each returns the instance, except \`response\`)

| Method | Sets |
| --- | --- |
| \`setData(data)\` | \`data\` |
| \`setMessage(message)\` | \`message\` |
| \`setStatusCode(code)\` | The HTTP status, 200 by default |
| \`setErrors(errors)\` | \`errors\`, and \`error\` to the first message when sent |
| \`setError(error)\` | \`error\`. Replaced by the first field message if \`errors\` is also set |
| \`setErrorCode(code)\` | \`errorCode\` |
| \`setServerError(error)\` | \`serverError\` with \`name\`, \`message\` and \`stack\`. Don't use it with sensitive errors |
| \`setAdditional(fields)\` | Extra top-level fields. \`data\`, \`message\` and the other standard fields win if a name clashes |
| \`response(res)\` | Sends it. Does nothing if a response was already sent |`,
        code: `import { ApiResponse } from '@qnx/response'

return ApiResponse.getInstance()
    .setStatusCode(202)
    .setData({ jobId: 'abc' })
    .setMessage('Queued.')
    .setAdditional({ meta: { position: 3 } })
// → 202 { meta: { position: 3 }, data: { jobId: 'abc' }, message: 'Queued.' }`
    }
}

function render(pattern: Pattern) {
    const { description, code, language = 'typescript' } = examples[pattern]
    return `## ${pattern}\n\n${description}\n\n\`\`\`${language}\n${code}\n\`\`\``
}

export const responseDocs = Object.fromEntries(
    (Object.keys(examples) as Pattern[]).map((pattern) => [pattern, render(pattern)])
) as Record<Pattern, string>

export function registerResponsePatternTool(server: McpServer) {
    server.registerTool(
        'get-response-docs',
        {
            ...readOnlyTool('@qnx/response docs'),
            description: 'Get documentation for @qnx/response — Express handler utilities that standardize HTTP response shapes. asyncValidatorHandler auto-catches @qnx/errors and ZodErrors; initializeApiResponse controls the success response body. Read handler-return-values and server-error before shipping. Pass "all" for the full reference.',
            inputSchema: {
                pattern: z.enum(patterns).describe(patterns.join(' | '))
            }
        },
        async ({ pattern }) => textResult(
            pattern === 'all'
                ? ['# `@qnx/response` Reference\n', ...Object.values(responseDocs)].join('\n\n---\n\n')
                : responseDocs[pattern]
        )
    )
}
