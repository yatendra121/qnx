import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readOnlyTool, textResult } from './shared'

const errorClasses = ['install', 'http-responses', 'ApiError', 'ValidationError', 'InvalidValueError', 'UnauthenticatedUserError', 'ServerError', 'ApiResponseErrorsValue', 'all'] as const

type ErrorClassKey = Exclude<typeof errorClasses[number], 'all'>

export const errorClassDocs: Record<ErrorClassKey, string> = {
    install: `## Install

\`\`\`bash
npm install @qnx/errors
\`\`\`

It has no dependencies. Use it with \`@qnx/response\`, which needs \`@qnx/errors\` 0.8.8 or later.`,

    'http-responses': `## What Each Class Sends

The response \`asyncValidatorHandler\` sends when you throw each class, with the default codes:

| You throw | Status | Body | Does your message reach the client? |
| --- | --- | --- | --- |
| \`ValidationError\` | 400 | \`{ errors, error }\` | **No.** \`error\` is the first field's first message |
| \`InvalidValueError\` | 400 | \`{ errors, error }\` | Yes |
| \`UnauthenticatedUserError\` | 401 | \`{ errorCode: 'unauthenticated', message: 'Unauthenticated' }\` | **No.** It's always the same body |
| \`ServerError\` | 500 | \`{ message }\` | Yes, so keep it safe to show |
| \`ApiError\` | Your code | \`{ message }\`, plus \`errors\` and \`error\` if given | Yes |
| Any other error | 500 | \`{ serverError: { name, message, stack } }\` | **Yes, with the stack trace** |

Only the last row calls the \`setCallback\` logger from \`@qnx/response\`. Log the others yourself if you need them.`,

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
| \`getErrorResponse()\` | \`ErrorResponse | undefined\` | The error response object, if provided |

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

> **Note:** \`ApiError\` is exported from \`@qnx/errors\`. Use it for custom status codes (e.g. 409); prefer the specialized subclasses where one fits.`,

    ValidationError: `## \`ValidationError\`

> For multi-field form or schema validation failures.

**Extends:** \`ApiError\`

**Default code:** \`errorCodes.VALIDATION_ERROR_CODE\` (default: \`400\`)

**Constructor**
\`\`\`ts
new ValidationError(message: string, option: { errRes: ErrorResponse })
\`\`\`

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | \`VALIDATION_ERROR_CODE\` (default 400) |
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

**Use when:** Multiple fields fail validation at once (e.g. form submission, request body parsing).

> The message passed to the constructor never reaches the client. The response's \`error\` is the first field's first message.`,

    InvalidValueError: `## \`InvalidValueError\`

> For a single-field validation failure.

**Extends:** \`ValidationError\` → \`ApiError\`

**Default code:** \`errorCodes.VALIDATION_ERROR_CODE\` (default: \`400\`)

**Constructor**
\`\`\`ts
new InvalidValueError(message: string, { key }: { key: string })
\`\`\`

The \`key\` becomes the field name in \`errorResponse.errors\`, with the message as its value.

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getCode()\` | \`number\` | \`VALIDATION_ERROR_CODE\` (default 400) |
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

**Use when:** The request lacks a valid session or bearer token.

> The message isn't sent to the client: the response body is always \`{ errorCode: 'unauthenticated', message: 'Unauthenticated' }\`. It's only visible in your own code and logs.`,

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

**Use when:** A database call fails, an external service is unreachable, or any unrecoverable runtime error occurs.

> The message reaches the client as \`{ message }\` with no stack trace, so keep it safe to show. \`setCallback\` isn't called for this class, so log the original error yourself. A plain \`throw new Error()\` sends the message and stack trace to the client instead.`,

    ApiResponseErrorsValue: `## \`ApiResponseErrorsValue\`

> Collects field errors to pass to \`ValidationError\`.

**Methods**
| Method | Returns | Description |
| --- | --- | --- |
| \`getInstance()\` | \`ApiResponseErrorsValue\` | Static. Starts a new collection |
| \`addError(key, message)\` | \`this\` | Adds a message, keeping everything collected so far |
| \`setError(key, message)\` | \`this\` | **Replaces everything collected so far**, including other fields |
| \`hasErrors()\` | \`boolean\` | Whether any error was collected |
| \`getErrors()\` | \`ApiResponseErrors | undefined\` | The collected errors, or \`undefined\` if there are none |
| \`getErrorResponse()\` | \`ErrorResponse\` | \`{ errors }\`, ready to pass as \`errRes\` |

**Example**
\`\`\`ts
import { ApiResponseErrorsValue, ValidationError } from '@qnx/errors'

const collected = ApiResponseErrorsValue.getInstance()
if (!body.email) collected.addError('email', 'Email is required.')
if (!body.name) collected.addError('name', 'Name is required.')

if (collected.hasErrors()) {
  throw new ValidationError('Validation failed', { errRes: collected.getErrorResponse() })
}
\`\`\`

> Use \`addError\` to collect errors. Two \`setError\` calls keep only the second.`
}

export const errorSummaryDocs = `## Summary

| Error Class | Purpose | Default Code | Use When |
| --- | --- | --- | --- |
| \`ApiError\` | Generic base error | Custom | No subclass fits, e.g. a 409 conflict |
| \`ValidationError\` | Multi-field validation | 400 | Input or schema validation fails |
| \`InvalidValueError\` | Single-field validation | 400 | One field like \`email\` or \`username\` is bad |
| \`UnauthenticatedUserError\` | Auth failure | 401 | User not logged in or token missing |
| \`ServerError\` | Internal system failure | 500 | Something broke that the user cannot fix |`

export const errorCodesDocs = `## Customizing Error Codes

Change the default HTTP status codes for the whole app using \`setErrorCodes\`, for example to send validation failures as 422:

\`\`\`ts
import { setErrorCodes } from '@qnx/errors'

setErrorCodes({
  VALIDATION_ERROR_CODE: 422, // default 400
  UNAUTHENTICATED_USER_ERROR_CODE: 401,
  SERVER_ERROR_CODE: 500
})
\`\`\`

All three keys are optional — only the ones you provide will be updated. Call it once at startup: the classes read the codes when they're constructed. \`errorCodes\` holds the current values, and the \`ApiResponseErrors\` and \`ErrorResponse\` types describe the error maps.`

export function registerCreateErrorInstanceTool(server: McpServer) {
    server.registerTool(
        'get-error-class-docs',
        {
            ...readOnlyTool('@qnx/errors docs'),
            description: 'Get documentation for @qnx/errors — structured error types (ValidationError, UnauthenticatedUserError, ServerError, InvalidValueError) that integrate with @qnx/response to produce consistent HTTP error responses. http-responses shows what each class sends to the client. Pass "all" for the full reference including the summary table and custom codes guide.',
            inputSchema: {
                errorClass: z.enum(errorClasses).describe(
                    errorClasses.join(' | ')
                )
            }
        },
        async ({ errorClass }) => textResult(
            errorClass === 'all'
                ? ['# `@qnx/errors` Reference\n', ...Object.values(errorClassDocs), errorSummaryDocs, errorCodesDocs].join('\n\n---\n\n')
                : errorClassDocs[errorClass]
        )
    )
}
