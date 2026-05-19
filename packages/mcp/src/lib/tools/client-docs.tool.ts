import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const topics = ['classes', 'api-response', 'success-response', 'error-response', 'types', 'patterns', 'all'] as const

const docs: Record<Exclude<typeof topics[number], 'all'>, string> = {
    classes: `## Classes Overview

\`@qnx/client\` exports three response wrapper classes. Choose based on what the response contains:

| Class | Use when | Required fields |
| --- | --- | --- |
| \`ApiResponse<T>\` | You don't know if the response is success or error | None — all fields optional |
| \`ApiSuccessResponse<T>\` | You are certain the response is a success | \`data\` + \`message\` |
| \`ApiErrorResponse\` | You are certain the response is an error | \`error\` + \`errors\` |

**Import**
\`\`\`ts
import { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from '@qnx/client'
\`\`\`

> Use \`ApiResponse\` when wrapping a raw fetch/axios response before checking its shape.
> Use \`ApiSuccessResponse\` / \`ApiErrorResponse\` only after you have confirmed the response type.`,

    'api-response': `## \`ApiResponse<T>\`

General-purpose wrapper for any API response. All fields are optional — safe to use before knowing if the response succeeded or failed.

**Constructor**
\`\`\`ts
new ApiResponse<T>(response?: ApiResponseValue<T>)
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getData()\` | \`T \| undefined\` | The response payload |
| \`getMessage()\` | \`string \| undefined\` | Human-readable success message |
| \`getError()\` | \`string \| undefined\` | Top-level error message |
| \`getErrors()\` | \`Record<string, string[]> \| undefined\` | Field-level validation errors |
| \`getErrorCode()\` | \`string \| undefined\` | Machine-readable error code |

**Example**
\`\`\`ts
import { ApiResponse } from '@qnx/client'

const res = new ApiResponse({
  data: { id: 1, name: 'Item' },
  message: 'Fetched successfully.',
  error: undefined,
  errors: undefined,
  errorCode: undefined
})

res.getData()      // { id: 1, name: 'Item' }
res.getMessage()   // 'Fetched successfully.'
res.getError()     // undefined
res.getErrors()    // undefined
res.getErrorCode() // undefined
\`\`\`

**Error case**
\`\`\`ts
const res = new ApiResponse({
  error: 'Validation failed',
  errors: {
    email: ['Email is required'],
    name: ['Name must be at least 2 characters']
  },
  errorCode: 'ERR_VALIDATION'
})

res.getData()      // undefined
res.getError()     // 'Validation failed'
res.getErrors()    // { email: ['Email is required'], name: ['Name must be...'] }
res.getErrorCode() // 'ERR_VALIDATION'
\`\`\``,

    'success-response': `## \`ApiSuccessResponse<T>\`

Wrapper for confirmed success responses. Both \`data\` and \`message\` are required.

**Constructor**
\`\`\`ts
new ApiSuccessResponse<T>(response: ApiSuccessResponseValue<T>)
// where ApiSuccessResponseValue<T> = { data: T, message: string }
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getData()\` | \`T\` | The response payload (always defined) |
| \`getMessage()\` | \`string\` | The success message (always defined) |

> Unlike \`ApiResponse\`, both methods here return non-optional values — safe to use without null checks.

**Example**
\`\`\`ts
import { ApiSuccessResponse } from '@qnx/client'

const res = new ApiSuccessResponse({
  data: { id: 1, name: 'Item' },
  message: 'Item created successfully.'
})

res.getData()    // { id: 1, name: 'Item' }
res.getMessage() // 'Item created successfully.'
\`\`\`

> **Important:** Only use \`ApiSuccessResponse\` after confirming the response has no error. If \`data\` or \`message\` may be absent, use \`ApiResponse\` instead.`,

    'error-response': `## \`ApiErrorResponse\`

Wrapper for confirmed error responses. \`error\` and \`errors\` are required; \`errorCode\` is optional.

**Constructor**
\`\`\`ts
new ApiErrorResponse(response: ApiErrorResponseValue)
// where ApiErrorResponseValue = { error: string, errors: Record<string, string[]>, errorCode?: string }
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getError()\` | \`string\` | Top-level error message (always defined) |
| \`getErrors()\` | \`Record<string, string[]> \| undefined\` | Field-level validation errors |
| \`getErrorCode()\` | \`string \| undefined\` | Machine-readable error code |

**Example**
\`\`\`ts
import { ApiErrorResponse } from '@qnx/client'

const res = new ApiErrorResponse({
  error: 'Validation failed',
  errors: {
    email: ['Email is required', 'Email format is invalid'],
    password: ['Password must be at least 8 characters']
  },
  errorCode: 'ERR_VALIDATION'
})

res.getError()     // 'Validation failed'
res.getErrors()    // { email: [...], password: [...] }
res.getErrorCode() // 'ERR_VALIDATION'
\`\`\`

**Without errorCode**
\`\`\`ts
const res = new ApiErrorResponse({
  error: 'Something went wrong',
  errors: {}
})

res.getErrorCode() // undefined
\`\`\``,

    types: `## TypeScript Types

### \`ApiResponseValue<T>\`
Full API response shape. All fields optional.

\`\`\`ts
import type { ApiResponseValue } from '@qnx/client'

interface ApiResponseValue<T = any> {
  readonly data?: T
  readonly errorCode?: string
  readonly error?: string
  readonly errors?: Record<string, string[]>
  readonly message?: string
  readonly serverError?: any
}
\`\`\`

### \`ApiSuccessResponseValue<T>\`
Strict success shape. Both \`data\` and \`message\` are required.

\`\`\`ts
import type { ApiSuccessResponseValue } from '@qnx/client'

// Equivalent to: { data: T, message: string }
type ApiSuccessResponseValue<T> = Pick<Required<ApiResponseValue<T>>, 'data' | 'message'>
\`\`\`

### \`ApiErrorResponseValue\`
Strict error shape. \`error\` and \`errors\` are required; \`errorCode\` optional.

\`\`\`ts
import type { ApiErrorResponseValue } from '@qnx/client'

// Equivalent to: { error: string, errors: Record<string, string[]>, errorCode?: string }
type ApiErrorResponseValue = Pick<Required<ApiResponseValue>, 'errors' | 'error'>
    & Pick<ApiResponseValue, 'errorCode'>
\`\`\`

### Summary

| Type | \`data\` | \`message\` | \`error\` | \`errors\` | \`errorCode\` |
| --- | --- | --- | --- | --- | --- |
| \`ApiResponseValue<T>\` | optional | optional | optional | optional | optional |
| \`ApiSuccessResponseValue<T>\` | **required** | **required** | — | — | — |
| \`ApiErrorResponseValue\` | — | — | **required** | **required** | optional |`,

    patterns: `## Common Patterns

### Wrapping a fetch response
\`\`\`ts
import { ApiResponse } from '@qnx/client'

const raw = await fetch('/api/users/1').then(r => r.json())
const res = new ApiResponse(raw)

if (res.getError()) {
  console.error(res.getError())
  console.error(res.getErrors()) // field-level detail if available
} else {
  console.log(res.getData())
  console.log(res.getMessage())
}
\`\`\`

### Wrapping an axios response
\`\`\`ts
import { ApiResponse } from '@qnx/client'
import axios from 'axios'

const { data } = await axios.get('/api/users/1')
const res = new ApiResponse(data)
\`\`\`

### Using typed success response
\`\`\`ts
import { ApiSuccessResponse } from '@qnx/client'

type User = { id: number; name: string }

async function createUser(payload: unknown) {
  const raw = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(r => r.json())

  const res = new ApiSuccessResponse<User>(raw)
  return res.getData()  // typed as User — no undefined check needed
}
\`\`\`

### Handling validation errors
\`\`\`ts
import { ApiErrorResponse } from '@qnx/client'

const raw = await fetch('/api/users', { method: 'POST', body: JSON.stringify(payload) })
  .then(r => r.json())

if (!raw.data) {
  const err = new ApiErrorResponse(raw)
  const fieldErrors = err.getErrors()

  if (fieldErrors?.email) {
    showFieldError('email', fieldErrors.email[0])
  }
}
\`\`\`

### Typing response fields
\`\`\`ts
import type { ApiResponseValue, ApiSuccessResponseValue, ApiErrorResponseValue } from '@qnx/client'

// Use as function parameter/return types
function handleSuccess(res: ApiSuccessResponseValue<User>) {
  return res.data // typed as User
}

function handleError(res: ApiErrorResponseValue) {
  return res.errors // typed as Record<string, string[]>
}
\`\`\``
}

export function registerClientDocsTool(server: McpServer) {
    server.registerTool(
        'get-client-docs',
        {
            description: 'Get documentation for @qnx/client — TypeScript classes for consuming @qnx/response-shaped API responses. Gives type-safe access to data, messages, and field errors on the client side via ApiResponse, ApiSuccessResponse, and ApiErrorResponse. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe(
                    'classes | api-response | success-response | error-response | types | patterns | all'
                )
            }
        },
        async ({ topic }) => {
            let text: string

            if (topic === 'all') {
                text = [
                    '# `@qnx/client` Reference\n',
                    docs.classes,
                    docs['api-response'],
                    docs['success-response'],
                    docs['error-response'],
                    docs.types,
                    docs.patterns
                ].join('\n\n---\n\n')
            } else {
                text = docs[topic]
            }

            return {
                content: [{ type: 'text', text }]
            }
        }
    )
}
