import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readOnlyTool, textResult } from './shared'

const topics = ['install', 'handling-responses', 'classes', 'api-response', 'success-response', 'error-response', 'types', 'patterns', 'all'] as const

export const clientDocs: Record<Exclude<typeof topics[number], 'all'>, string> = {
    install: `## Install

\`\`\`bash
npm install @qnx/client
\`\`\`

It has no dependencies and runs in browsers and Node.js.`,

    'handling-responses': `## Handling Real Responses

**Check \`response.ok\` or the status to detect failure.** The response classes only read fields, and no single field is present on every failure or every success.

What \`@qnx/response\` really sends, and what each common check concludes:

| Response | Body | \`if (res.getError())\` | \`if (!raw.data)\` | \`response.ok\` |
| --- | --- | --- | --- | --- |
| 200 with data | \`{ data }\` | Success ✅ | Success ✅ | ✅ |
| 200 message only, such as a delete | \`{ message }\` | Success ✅ | **Error ❌** | ✅ |
| 400 validation | \`{ errors, error }\` | Error ✅ | Error ✅ | ✅ |
| 401 unauthenticated | \`{ errorCode, message }\` | **Success ❌** | Error ✅ | ✅ |
| 409 \`ApiError\` | \`{ message }\` | **Success ❌** | Error ✅ | ✅ |
| 500 \`ServerError\` | \`{ message }\` | **Success ❌** | Error ✅ | ✅ |
| 500 unexpected | \`{ serverError }\` | **Success ❌** | Error ✅ | ✅ |
| 404 from a handler that returned nothing | HTML, not JSON | \`response.json()\` throws | \`response.json()\` throws | ✅ |

**A helper that handles all of them**
\`\`\`ts
import { ApiResponse } from '@qnx/client'
import type { ApiResponseValue } from '@qnx/client'

async function apiRequest<T>(path: string, init?: RequestInit) {
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

**With axios**, a non-2xx status rejects the promise, so read the body from \`err.response.data\` in a catch block.

**\`serverError\`** has no getter, and it holds a stack trace. Read \`raw.serverError\` only to debug, and never show it to users.`,

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
> Use \`ApiSuccessResponse\` / \`ApiErrorResponse\` only after you have confirmed the response type with \`response.ok\`. See handling-responses.
> None of them validate their input. The required fields are compile-time types only.`,

    'api-response': `## \`ApiResponse<T>\`

General-purpose wrapper for any API response. All fields are optional — safe to use before knowing if the response succeeded or failed.

**Constructor**
\`\`\`ts
new ApiResponse<T>(response?: ApiResponseValue<T>)
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getData()\` | \`T | undefined\` | The response payload |
| \`getMessage()\` | \`string | undefined\` | Human-readable success message |
| \`getError()\` | \`string | undefined\` | Top-level error message |
| \`getErrors()\` | \`Record<string, string[]> | undefined\` | Field-level validation errors |
| \`getErrorCode()\` | \`string | undefined\` | Machine-readable error code |

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
| \`getData()\` | \`T\` | The response payload |
| \`getMessage()\` | \`string\` | The success message |

> Both are typed as non-optional, but nothing checks that at runtime. A raw return value from a handler responds \`{ data }\` with no message, so \`getMessage()\` returns \`undefined\`, and a message-only response makes \`getData()\` return \`undefined\`.

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

> **Important:** Only use \`ApiSuccessResponse\` after confirming the response succeeded with \`response.ok\`. If \`data\` or \`message\` may be absent, use \`ApiResponse\` instead.`,

    'error-response': `## \`ApiErrorResponse\`

Wrapper for validation error responses, the only ones with both \`error\` and \`errors\`. On a real 401, 409 or 500, \`getError()\` and \`getErrors()\` return \`undefined\` and this class has no \`getMessage()\`, so use \`ApiResponse\` for those.

**Constructor**
\`\`\`ts
new ApiErrorResponse(response: ApiErrorResponseValue)
// where ApiErrorResponseValue = { error: string, errors: Record<string, string[]>, errorCode?: string }
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getError()\` | \`string\` | Top-level error message. Typed as a string, but \`undefined\` if the response has none |
| \`getErrors()\` | \`Record<string, string[]> | undefined\` | Field-level validation errors |
| \`getErrorCode()\` | \`string | undefined\` | Machine-readable error code |

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

\`serverError\` has no getter on the classes. Read it from the raw response, and only to debug.

\`ApiErrors\`, \`ApiErrorCode\`, \`ApiMessage\`, \`ApiError\` (a string alias, not the error class) and the \`ApiResponseInterface\`, \`ApiSuccessResponseInterface\` and \`ApiErrorResponseInterface\` types can also be imported from the package.

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

const response = await fetch('/api/users/1')
const res = new ApiResponse(await response.json())

// getError() alone isn't enough: it's undefined on 401, 409 and 500 responses
if (!response.ok) {
  console.error(res.getError() ?? res.getMessage())
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

try {
  const { data } = await axios.get('/api/users/1')
  const res = new ApiResponse(data)
  console.log(res.getData())
} catch (err) {
  // axios rejects on a non-2xx status
  const res = new ApiResponse(axios.isAxiosError(err) ? err.response?.data : undefined)
  console.error(res.getError() ?? res.getMessage())
}
\`\`\`

### Using typed success response
\`\`\`ts
import { ApiSuccessResponse } from '@qnx/client'

type User = { id: number; name: string }

async function createUser(payload: unknown) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) throw new Error(\`Request failed: \${response.status}\`)

  const res = new ApiSuccessResponse<User>(await response.json())
  return res.getData()  // typed as User
}
\`\`\`

### Handling validation errors
\`\`\`ts
import { ApiErrorResponse } from '@qnx/client'

const response = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})

if (response.status === 400) {
  const err = new ApiErrorResponse(await response.json())
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
            ...readOnlyTool('@qnx/client docs'),
            description: 'Get documentation for @qnx/client — TypeScript classes for consuming @qnx/response-shaped API responses. Gives type-safe access to data, messages, and field errors on the client side via ApiResponse, ApiSuccessResponse, and ApiErrorResponse. Read handling-responses first: it shows how to detect failures reliably. Pass "all" for the full reference.',
            inputSchema: {
                topic: z.enum(topics).describe(
                    'install | handling-responses | classes | api-response | success-response | error-response | types | patterns | all'
                )
            }
        },
        async ({ topic }) => textResult(
            topic === 'all'
                ? ['# `@qnx/client` Reference\n', ...Object.values(clientDocs)].join('\n\n---\n\n')
                : clientDocs[topic]
        )
    )
}
