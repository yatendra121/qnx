import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const errorClasses = ['ApiError', 'ValidationError', 'InvalidValueError', 'UnauthenticatedUserError', 'ServerError', 'all'] as const

type ErrorClassKey = Exclude<typeof errorClasses[number], 'all'>

const docs: Record<ErrorClassKey, string> = {
    ApiError: `## \`ApiError\`

> Base error class. All other error classes extend this.

**Purpose:** Generic customizable error with a manual HTTP status code and optional field-level error response.

**Constructor**
\`\`\`ts
new ApiError(message: string, code: number, option?: { errRes?: ErrorResponse })
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | The HTTP status code passed to the constructor |
| \`getErrorResponse()\` | \`ErrorResponse \| undefined\` | The error response object, if provided |

**Example**
\`\`\`ts
const error = new ApiError('Something went wrong', 500, {
  errRes: {
    errors: {
      generic: ['Unexpected error occurred']
    }
  }
})

error.message          // "Something went wrong"
error.getCode()        // 500
error.getErrorResponse() // { errors: { generic: ['Unexpected error occurred'] } }
\`\`\`

> **Note:** \`ApiError\` is an internal base class and is not exported from \`@qnx/errors\`. Use the specialized subclasses instead.`,

    ValidationError: `## \`ValidationError\`

> For multi-field form or schema validation failures.

**Extends:** \`ApiError\`

**Default code:** \`errorCodes.VALIDATION_ERROR_CODE\` (default: \`422\`)

**Constructor**
\`\`\`ts
new ValidationError(message: string, option: { errRes: ErrorResponse })
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | \`VALIDATION_ERROR_CODE\` (default 422) |
| \`getErrorResponse()\` | \`ErrorResponse\` | The full field-level error map |

**Example**
\`\`\`ts
import { ValidationError } from '@qnx/errors'

throw new ValidationError('Validation failed', {
  errRes: {
    errors: {
      email: ['Email is invalid'],
      password: ['Password must be at least 8 characters']
    }
  }
})
\`\`\`

**Use when:** Multiple fields fail validation at once (e.g. form submission, request body parsing).`,

    InvalidValueError: `## \`InvalidValueError\`

> For a single-field validation failure.

**Extends:** \`ValidationError\` → \`ApiError\`

**Default code:** \`errorCodes.VALIDATION_ERROR_CODE\` (default: \`422\`)

**Constructor**
\`\`\`ts
new InvalidValueError(message: string, { key }: { key: string })
\`\`\`

The \`key\` becomes the field name in \`errorResponse.errors\`, with the message as its value.

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | \`VALIDATION_ERROR_CODE\` (default 422) |
| \`getErrorResponse()\` | \`ErrorResponse\` | \`{ errors: { [key]: [message] } }\` |

**Example**
\`\`\`ts
import { InvalidValueError } from '@qnx/errors'

throw new InvalidValueError('Username cannot contain spaces', { key: 'username' })

// getErrorResponse() → { errors: { username: ['Username cannot contain spaces'] } }
\`\`\`

**Use when:** Exactly one field is invalid (e.g. checking a single query param or path value).`,

    UnauthenticatedUserError: `## \`UnauthenticatedUserError\`

> For missing or invalid authentication.

**Extends:** \`ApiError\`

**Default code:** \`errorCodes.UNAUTHENTICATED_USER_ERROR_CODE\` (default: \`401\`)

**Constructor**
\`\`\`ts
new UnauthenticatedUserError(message: string)
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | \`UNAUTHENTICATED_USER_ERROR_CODE\` (default 401) |
| \`getErrorResponse()\` | \`undefined\` | Always undefined — no field-level errors |

**Example**
\`\`\`ts
import { UnauthenticatedUserError } from '@qnx/errors'

throw new UnauthenticatedUserError('User not authenticated')

// getCode()          → 401
// getErrorResponse() → undefined
\`\`\`

**Use when:** The request lacks a valid session or bearer token.`,

    ServerError: `## \`ServerError\`

> For unexpected internal failures the user cannot fix.

**Extends:** \`ApiError\`

**Default code:** \`errorCodes.SERVER_ERROR_CODE\` (default: \`500\`)

**Constructor**
\`\`\`ts
new ServerError(message: string)
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | \`SERVER_ERROR_CODE\` (default 500) |
| \`getErrorResponse()\` | \`undefined\` | Always undefined — no field-level errors |

**Example**
\`\`\`ts
import { ServerError } from '@qnx/errors'

throw new ServerError('Internal server error')

// getCode()          → 500
// getErrorResponse() → undefined
\`\`\`

**Use when:** A database call fails, an external service is unreachable, or any unrecoverable runtime error occurs.`
}

const summaryTable = `## Summary

| Error Class | Purpose | Default Code | Use When |
| --- | --- | --- | --- |
| \`ApiError\` | Generic base error | Custom | Internal base — use subclasses instead |
| \`ValidationError\` | Multi-field validation | 422 | Input or schema validation fails |
| \`InvalidValueError\` | Single-field validation | 422 | One field like \`email\` or \`username\` is bad |
| \`UnauthenticatedUserError\` | Auth failure | 401 | User not logged in or token missing |
| \`ServerError\` | Internal system failure | 500 | Something broke that the user cannot fix |`

const customCodesDoc = `## Customizing Error Codes

Override the default HTTP codes globally using \`setErrorCodes\`:

\`\`\`ts
import { setErrorCodes } from '@qnx/errors'

setErrorCodes({
  VALIDATION_ERROR_CODE: 400,
  UNAUTHENTICATED_USER_ERROR_CODE: 401,
  SERVER_ERROR_CODE: 500
})
\`\`\`

All three keys are optional — only the ones you provide will be updated.`

export function registerCreateErrorInstanceTool(server: McpServer) {
    server.registerTool(
        'get-error-class-docs',
        {
            description: 'Get documentation for @qnx/errors — structured error types (ValidationError, UnauthenticatedUserError, ServerError, InvalidValueError) that integrate with @qnx/response to produce consistent HTTP error responses. Pass "all" for the full reference including the summary table and custom codes guide.',
            inputSchema: {
                errorClass: z.enum(errorClasses).describe(
                    'ApiError | ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError | all'
                )
            }
        },
        async ({ errorClass }) => {
            let text: string

            if (errorClass === 'all') {
                text = [
                    '# `@qnx/errors` Reference\n',
                    docs.ApiError,
                    docs.ValidationError,
                    docs.InvalidValueError,
                    docs.UnauthenticatedUserError,
                    docs.ServerError,
                    summaryTable,
                    customCodesDoc
                ].join('\n\n---\n\n')
            } else {
                text = docs[errorClass]
            }

            return {
                content: [{ type: 'text', text }]
            }
        }
    )
}
