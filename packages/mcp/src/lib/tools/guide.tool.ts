import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { McpServerConfig } from '../server'
import { readOnlyTool, textResult } from './shared'

export interface Guide {
    packages: (keyof McpServerConfig)[]
    text: string
}

/** Every fenced TypeScript block here is executed against the real packages by tools.contract.spec.ts. */
export const guides: Record<string, Guide> = {
    'crud-api': {
        packages: ['response', 'errors'],
        text: `# Build a CRUD API

Uses \`@qnx/response\` and \`@qnx/errors\`. Install with:

\`\`\`bash
npm install @qnx/response @qnx/errors express zod@4
\`\`\`

\`\`\`ts
import express from 'express'
import { z } from 'zod'
import { ApiResponse, initializeApiResponse, resourceRoute } from '@qnx/response'
import { ApiError } from '@qnx/errors'

const app = express()
app.use(express.json()) // without this, req.body is empty and validation fails

const ItemSchema = z.object({ name: z.string().min(1) })
const items = new Map([[1, { id: 1, name: 'First' }]]) // replace with your database

const findItem = (id: string) => {
    const item = items.get(Number(id))
    if (!item) throw new ApiError('Item not found.', 404)
    return item
}

const router = express.Router()
resourceRoute(router, {
    findAll: async () => [...items.values()],
    findOne: async (req) => findItem(req.params.id as string),
    create: async (req) => {
        const item = { id: items.size + 1, ...ItemSchema.parse(req.body) }
        items.set(item.id, item)
        return ApiResponse.getInstance().setStatusCode(201).setData(item).setMessage('Created.')
    },
    update: async (req) => {
        const item = { ...findItem(req.params.id as string), ...ItemSchema.parse(req.body) }
        items.set(item.id, item)
        return initializeApiResponse().setData(item).setMessage('Updated.')
    },
    remove: async (req) => {
        items.delete(findItem(req.params.id as string).id)
        // A method that returns nothing responds with an HTML 404
        return initializeApiResponse().setMessage('Deleted.')
    }
})
app.use('/items', router)
\`\`\`

| Request | Response |
| --- | --- |
| \`GET /items\` | 200 \`{ data: [...] }\` |
| \`GET /items/99\` | 404 \`{ message: 'Item not found.' }\` |
| \`POST /items\` with a valid body | 201 \`{ data, message }\` |
| \`POST /items\` with \`{ name: '' }\` | 400 \`{ errors: { name: [...] }, error }\` |
| \`DELETE /items/1\` | 200 \`{ message: 'Deleted.' }\` |

Before production, see the production-checklist guide.`
    },
    'server-and-client': {
        packages: ['response', 'errors', 'client'],
        text: `# Connect a Frontend to the API

Uses \`@qnx/client\` to read what \`@qnx/response\` sends. Install with \`npm install @qnx/client\`.

**Check \`response.ok\` to detect failure.** \`getError()\` is only set on validation responses, and \`data\` is absent from message-only successes such as a delete. See get-client-docs with topic handling-responses for the full table.

\`\`\`ts
import { ApiResponse } from '@qnx/client'
import type { ApiResponseValue } from '@qnx/client'

export async function apiRequest<T>(path: string, init?: RequestInit) {
    const response = await fetch(path, {
        ...init,
        // Without this, express.json() leaves req.body empty and validation fails
        headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
    // A route that returned nothing responds with an HTML 404
    const raw: ApiResponseValue<T> = await response.json().catch(() => ({}))
    const res = new ApiResponse<T>(raw)

    if (response.ok) {
        return { ok: true as const, data: res.getData(), message: res.getMessage() }
    }
    return {
        ok: false as const,
        status: response.status,
        // error on validation responses, message on 401, ApiError and ServerError
        message: res.getError() ?? res.getMessage() ?? 'Something went wrong.',
        fieldErrors: res.getErrors(),
        errorCode: res.getErrorCode()
    }
}
\`\`\`

**Using it**

\`\`\`text
const result = await apiRequest<User>('/api/users', { method: 'POST', body: JSON.stringify(form) })

if (result.ok) showToast(result.message)
else if (result.status === 401) redirectToLogin()
else if (result.fieldErrors) showFieldErrors(result.fieldErrors)
else showToast(result.message)
\`\`\`

On an unexpected 500, the body holds \`serverError\` with a stack trace. This helper never shows it to the user. To stop it being sent at all, see the production-checklist guide.`
    },
    'auth-session': {
        packages: ['crypto', 'response', 'errors'],
        text: `# Add Login, Sessions and Logout

Uses \`@qnx/crypto\` for tokens. First generate your keys: see get-crypto-docs with topic setup.

**Auth tokens never expire on their own**, because they have no \`exp\` claim. The session record below is what ends a session, so it's required rather than optional.

\`\`\`ts
import express from 'express'
import { decryptAuthToken, generateAuthToken } from '@qnx/crypto'
import { UnauthenticatedUserError } from '@qnx/errors'
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Replace with a database table keyed by jti
const sessions = new Map<string, { userId: string; expiresAt: number }>()

async function requireSession(req: express.Request) {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    if (!token) throw new UnauthenticatedUserError('Missing token')

    // decryptAuthToken throws for a changed token, or one made with different keys
    const payload = await decryptAuthToken(token).catch(() => {
        throw new UnauthenticatedUserError('Invalid token')
    })

    const jti = payload.jti as string
    const session = sessions.get(jti)
    if (!session || session.expiresAt < Date.now()) {
        sessions.delete(jti)
        throw new UnauthenticatedUserError('Session expired')
    }
    return { jti, userId: session.userId }
}

const router = express.Router()

router.post('/login', asyncValidatorHandler(async (req) => {
    // Replace with your own password check. Throw UnauthenticatedUserError if it fails.
    const user = await checkCredentials(req.body)

    const { token, dbToken } = await generateAuthToken(String(user.id))
    sessions.set(dbToken, { userId: String(user.id), expiresAt: Date.now() + SESSION_TTL_MS })
    return initializeApiResponse().setData({ token }).setMessage('Logged in.')
}))

router.get('/me', asyncValidatorHandler(async (req) => {
    const { userId } = await requireSession(req)
    return { userId }
}))

router.post('/logout', asyncValidatorHandler(async (req) => {
    const { jti } = await requireSession(req)
    sessions.delete(jti)
    return initializeApiResponse().setMessage('Logged out.')
}))
\`\`\`

Every failure above responds 401 with the same body: \`{ errorCode: 'unauthenticated', message: 'Unauthenticated' }\`. The message you pass only shows up in your own code and logs, so a client can't tell an expired session from a bad token.

Storing the token in an \`httpOnly\` cookie rather than in JavaScript protects it from cross-site scripting. If you do, read it from the cookie in \`requireSession\` and add CSRF protection.`
    },
    'production-checklist': {
        packages: ['response', 'errors', 'client', 'crypto', 'winston', 'log'],
        text: `# Production Checklist

What the happy-path docs don't show. Each item is a real behaviour of the packages.

## \`@qnx/response\` and \`@qnx/errors\`

- [ ] **Stop stack traces reaching clients.** Any error that isn't a @qnx/errors class or ZodError is sent with its message and stack trace, in every environment. Use \`safeHandler\`: get-response-docs with pattern server-error.
- [ ] **Log your errors.** \`setCallback\` only sees unexpected errors. Log the original yourself before throwing \`ServerError\` or \`ApiError\`.
- [ ] **Return something from every route.** A handler that returns nothing calls \`next()\`, usually ending in an HTML 404: get-response-docs with pattern handler-return-values.
- [ ] **Set non-200 statuses.** A create responds 200 unless you call \`setStatusCode(201)\`.
- [ ] **Don't rely on \`UnauthenticatedUserError\` or \`ValidationError\` messages** to reach the client. Neither does.
- [ ] **Call \`setErrorCodes\` once at startup,** if you change the codes.

## \`@qnx/client\`

- [ ] **Check \`response.ok\` or the status.** \`getError()\` is undefined on 401, 409 and 500: get-client-docs with topic handling-responses.
- [ ] **Send \`Content-Type: application/json\`** on requests with a JSON body.

## \`@qnx/crypto\`

- [ ] **Enforce session lifetime yourself.** Auth tokens have no \`exp\` claim: get-guide with topic auth-session.
- [ ] **Keep private keys out of git,** and use separate keys per environment.
- [ ] **Set \`expirationTime\`** on every \`jwtSign\` call. Without it, the token never expires.
- [ ] **Use a long enough HMAC secret:** at least 32 bytes for HS256. jose accepts shorter ones.
- [ ] **Check PEM line breaks** on your host: get-crypto-docs with topic setup.

## \`@qnx/winston\`

- [ ] **Log errors with \`logger.error('message', err)\`.** \`{ error: err }\` writes \`{}\`: get-file-logger-docs with topic logging-errors.
- [ ] **Give it a writable working directory.** Importing it creates \`./logs\`, and the import throws if that fails, as it would on a read-only filesystem. It has no console transport, so on hosts without lasting disks, such as serverless platforms, use your own logger instead.
- [ ] **Don't log secrets.** Metadata is written as it is, so avoid logging whole request bodies with passwords or tokens.
- [ ] **Decide what happens after an uncaught exception.** The logger keeps the process running.

## \`@qnx/log\`

- [ ] **Use it for development and scripts.** It only writes to the console, so use \`@qnx/winston\` for lasting records.`
    }
}

function guidesFor(config: McpServerConfig) {
    return Object.entries(guides)
        .filter(([, { packages }]) => packages.some((name) => config[name]))
        .map(([topic]) => topic)
}

export function registerGuideTool(server: McpServer, config: McpServerConfig) {
    const topics = guidesFor(config)
    if (topics.length === 0) return

    server.registerTool(
        'get-guide',
        {
            ...readOnlyTool('End-to-end guides'),
            description: 'Get an end-to-end guide that shows how the @qnx/* packages work together, with tested code. Use it when building a feature rather than looking up one function. crud-api: an API with validation and errors. server-and-client: a frontend reading those responses. auth-session: login, sessions and logout. production-checklist: what to check before shipping.',
            inputSchema: {
                topic: z.enum(topics as [string, ...string[]]).describe(topics.join(' | '))
            }
        },
        async ({ topic }) => textResult(guides[topic].text)
    )
}
