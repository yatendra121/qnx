#!/usr/bin/env node
import e from "express";
import { StreamableHTTPServerTransport as t } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest as n } from "@modelcontextprotocol/sdk/types.js";
import { McpServer as r } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InvalidValueError as i, ServerError as a, UnauthenticatedUserError as o, ValidationError as s, errorCodes as c } from "@qnx/errors";
import { z as l } from "zod";
//#region src/lib/tools/format-error.tool.ts
var u = [
	"ValidationError",
	"InvalidValueError",
	"UnauthenticatedUserError",
	"ServerError"
], d = {
	ValidationError: "Requires: message, fields (≥1 entry with field + message)",
	InvalidValueError: "Requires: message, fields (exactly 1 entry with field + message)",
	UnauthenticatedUserError: "Requires: message only — fields is ignored",
	ServerError: "Requires: message only — fields is ignored"
};
function f(e) {
	e.registerTool("build-api-error", {
		description: [
			"Instantiate a @qnx/errors class with real values and return its resolved code, message, and errorResponse.",
			"",
			"Required params per errorClass:",
			"  ValidationError          → message + fields (≥1 entry)",
			"  InvalidValueError        → message + fields (exactly 1 entry)",
			"  UnauthenticatedUserError → message only",
			"  ServerError              → message only"
		].join("\n"),
		inputSchema: {
			errorClass: l.enum(u).describe("ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError"),
			message: l.string().describe("The error message (required for all classes)"),
			fields: l.array(l.object({
				field: l.string().describe("Field name (e.g. \"email\")"),
				message: l.string().describe("Error message for this field")
			})).optional().describe("ValidationError: required, ≥1 entry. InvalidValueError: required, first entry used. Others: not applicable.")
		}
	}, async ({ errorClass: e, message: t, fields: n }) => {
		if (e === "ValidationError") {
			if (!n || n.length === 0) return { content: [{
				type: "text",
				text: `Error: ValidationError requires at least one entry in "fields". ${d.ValidationError}`
			}] };
			let r = {};
			for (let e of n) r[e.field] = [e.message];
			let i = new s(t, { errRes: { errors: r } });
			return { content: [{
				type: "text",
				text: JSON.stringify({
					errorClass: e,
					message: i.message,
					code: i.getCode(),
					errorResponse: i.getErrorResponse()
				}, null, 2)
			}] };
		}
		if (e === "InvalidValueError") {
			if (!n || n.length === 0) return { content: [{
				type: "text",
				text: `Error: InvalidValueError requires exactly one entry in "fields". ${d.InvalidValueError}`
			}] };
			let { field: t, message: r } = n[0], a = new i(r, { key: t });
			return { content: [{
				type: "text",
				text: JSON.stringify({
					errorClass: e,
					message: a.message,
					code: a.getCode(),
					errorResponse: a.getErrorResponse()
				}, null, 2)
			}] };
		}
		if (e === "UnauthenticatedUserError") {
			let n = new o(t);
			return { content: [{
				type: "text",
				text: JSON.stringify({
					errorClass: e,
					message: n.message,
					code: n.getCode(),
					errorResponse: null
				}, null, 2)
			}] };
		}
		let r = new a(t);
		return { content: [{
			type: "text",
			text: JSON.stringify({
				errorClass: e,
				message: r.message,
				code: r.getCode(),
				errorResponse: null
			}, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/create-error-instance.tool.ts
var p = [
	"ApiError",
	"ValidationError",
	"InvalidValueError",
	"UnauthenticatedUserError",
	"ServerError",
	"all"
], m = {
	ApiError: "## `ApiError`\n\n> Base error class. All other error classes extend this.\n\n**Purpose:** Generic customizable error with a manual HTTP status code and optional field-level error response.\n\n**Constructor**\n```ts\nnew ApiError(message: string, code: number, option?: { errRes?: ErrorResponse })\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | The HTTP status code passed to the constructor |\n| `getErrorResponse()` | `ErrorResponse | undefined` | The error response object, if provided |\n\n**Example**\n```ts\nconst error = new ApiError('Something went wrong', 500, {\n  errRes: {\n    errors: {\n      generic: ['Unexpected error occurred']\n    }\n  }\n})\n\nerror.message          // \"Something went wrong\"\nerror.getCode()        // 500\nerror.getErrorResponse() // { errors: { generic: ['Unexpected error occurred'] } }\n```\n\n> **Note:** `ApiError` is an internal base class and is not exported from `@qnx/errors`. Use the specialized subclasses instead.",
	ValidationError: "## `ValidationError`\n\n> For multi-field form or schema validation failures.\n\n**Extends:** `ApiError`\n\n**Default code:** `errorCodes.VALIDATION_ERROR_CODE` (default: `422`)\n\n**Constructor**\n```ts\nnew ValidationError(message: string, option: { errRes: ErrorResponse })\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `VALIDATION_ERROR_CODE` (default 422) |\n| `getErrorResponse()` | `ErrorResponse` | The full field-level error map |\n\n**Example**\n```ts\nimport { ValidationError } from '@qnx/errors'\n\nthrow new ValidationError('Validation failed', {\n  errRes: {\n    errors: {\n      email: ['Email is invalid'],\n      password: ['Password must be at least 8 characters']\n    }\n  }\n})\n```\n\n**Use when:** Multiple fields fail validation at once (e.g. form submission, request body parsing).",
	InvalidValueError: "## `InvalidValueError`\n\n> For a single-field validation failure.\n\n**Extends:** `ValidationError` → `ApiError`\n\n**Default code:** `errorCodes.VALIDATION_ERROR_CODE` (default: `422`)\n\n**Constructor**\n```ts\nnew InvalidValueError(message: string, { key }: { key: string })\n```\n\nThe `key` becomes the field name in `errorResponse.errors`, with the message as its value.\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `VALIDATION_ERROR_CODE` (default 422) |\n| `getErrorResponse()` | `ErrorResponse` | `{ errors: { [key]: [message] } }` |\n\n**Example**\n```ts\nimport { InvalidValueError } from '@qnx/errors'\n\nthrow new InvalidValueError('Username cannot contain spaces', { key: 'username' })\n\n// getErrorResponse() → { errors: { username: ['Username cannot contain spaces'] } }\n```\n\n**Use when:** Exactly one field is invalid (e.g. checking a single query param or path value).",
	UnauthenticatedUserError: "## `UnauthenticatedUserError`\n\n> For missing or invalid authentication.\n\n**Extends:** `ApiError`\n\n**Default code:** `errorCodes.UNAUTHENTICATED_USER_ERROR_CODE` (default: `401`)\n\n**Constructor**\n```ts\nnew UnauthenticatedUserError(message: string)\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `UNAUTHENTICATED_USER_ERROR_CODE` (default 401) |\n| `getErrorResponse()` | `undefined` | Always undefined — no field-level errors |\n\n**Example**\n```ts\nimport { UnauthenticatedUserError } from '@qnx/errors'\n\nthrow new UnauthenticatedUserError('User not authenticated')\n\n// getCode()          → 401\n// getErrorResponse() → undefined\n```\n\n**Use when:** The request lacks a valid session or bearer token.",
	ServerError: "## `ServerError`\n\n> For unexpected internal failures the user cannot fix.\n\n**Extends:** `ApiError`\n\n**Default code:** `errorCodes.SERVER_ERROR_CODE` (default: `500`)\n\n**Constructor**\n```ts\nnew ServerError(message: string)\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `SERVER_ERROR_CODE` (default 500) |\n| `getErrorResponse()` | `undefined` | Always undefined — no field-level errors |\n\n**Example**\n```ts\nimport { ServerError } from '@qnx/errors'\n\nthrow new ServerError('Internal server error')\n\n// getCode()          → 500\n// getErrorResponse() → undefined\n```\n\n**Use when:** A database call fails, an external service is unreachable, or any unrecoverable runtime error occurs."
}, h = "## Summary\n\n| Error Class | Purpose | Default Code | Use When |\n| --- | --- | --- | --- |\n| `ApiError` | Generic base error | Custom | Internal base — use subclasses instead |\n| `ValidationError` | Multi-field validation | 422 | Input or schema validation fails |\n| `InvalidValueError` | Single-field validation | 422 | One field like `email` or `username` is bad |\n| `UnauthenticatedUserError` | Auth failure | 401 | User not logged in or token missing |\n| `ServerError` | Internal system failure | 500 | Something broke that the user cannot fix |", g = "## Customizing Error Codes\n\nOverride the default HTTP codes globally using `setErrorCodes`:\n\n```ts\nimport { setErrorCodes } from '@qnx/errors'\n\nsetErrorCodes({\n  VALIDATION_ERROR_CODE: 400,\n  UNAUTHENTICATED_USER_ERROR_CODE: 401,\n  SERVER_ERROR_CODE: 500\n})\n```\n\nAll three keys are optional — only the ones you provide will be updated.";
function _(e) {
	e.registerTool("get-error-class-docs", {
		description: "Get documentation for @qnx/errors — structured error types (ValidationError, UnauthenticatedUserError, ServerError, InvalidValueError) that integrate with @qnx/response to produce consistent HTTP error responses. Pass \"all\" for the full reference including the summary table and custom codes guide.",
		inputSchema: { errorClass: l.enum(p).describe("ApiError | ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError | all") }
	}, async ({ errorClass: e }) => {
		let t;
		return t = e === "all" ? [
			"# `@qnx/errors` Reference\n",
			m.ApiError,
			m.ValidationError,
			m.InvalidValueError,
			m.UnauthenticatedUserError,
			m.ServerError,
			h,
			g
		].join("\n\n---\n\n") : m[e], { content: [{
			type: "text",
			text: t
		}] };
	});
}
//#endregion
//#region src/lib/tools/logger-docs.tool.ts
var v = [
	"usage",
	"levels",
	"output",
	"configuration",
	"patterns",
	"all"
], y = {
	usage: "## Usage\n\n**Installation**\n```bash\nnpm install @qnx/winston winston winston-daily-rotate-file\n```\n\n**Import**\n```ts\nimport { logger } from '@qnx/winston'\n```\n\n**Basic examples**\n```ts\nlogger.info('Server started on port 3000')\nlogger.warn('Deprecated endpoint called')\nlogger.error('Something went wrong', { error: err })\nlogger.debug('User data', { user })\n```\n\n> The logger is a pre-configured singleton — import and use it directly with no additional setup required.",
	levels: "## Log Levels\n\nWinston uses the following levels in order of severity (lowest → highest):\n\n| Level | Method | When to use |\n| --- | --- | --- |\n| `silly` | `logger.silly()` | Extremely verbose noise |\n| `debug` | `logger.debug()` | Development diagnostics |\n| `verbose` | `logger.verbose()` | Detailed flow tracing |\n| `http` | `logger.http()` | HTTP request/response logging |\n| `info` | `logger.info()` | General operational events |\n| `warn` | `logger.warn()` | Recoverable issues or deprecations |\n| `error` | `logger.error()` | Failures that need attention |\n\n**Active level by environment**\n- `development` → `debug` and above are logged\n- `production` → `warn` and above are logged\n\n**Passing metadata**\n```ts\nlogger.info('User created', { userId: 42, email: 'user@example.com' })\nlogger.error('DB connection failed', { error: err, retries: 3 })\n```",
	output: "## Log Output Structure\n\nLogs are written in two destinations:\n\n### File (daily rotated)\n- Format: **JSON** with timestamp and stack trace on errors\n- Location: `logs/YYYY-MM-DD.log`\n- Rotation: daily, zipped archive, max `20mb` per file, kept for `14 days`\n\n```json\n{\n  \"level\": \"info\",\n  \"message\": \"Server started on port 3000\",\n  \"timestamp\": \"2025-07-28T10:00:00.000Z\"\n}\n```\n\n```json\n{\n  \"level\": \"error\",\n  \"message\": \"Unexpected failure\",\n  \"stack\": \"Error: Unexpected failure\\n    at ...\",\n  \"timestamp\": \"2025-07-28T10:01:00.000Z\"\n}\n```\n\n### File structure\n```\nlogs/\n├── 2025-07-27.log.gz   ← archived previous days\n├── 2025-07-28.log      ← today's active log\n└── 2025-07-29.log\n```",
	configuration: "## Configuration\n\nThe logger comes pre-configured — no setup needed. Key defaults:\n\n| Setting | Value |\n| --- | --- |\n| Log directory | `logs/` (auto-created if missing) |\n| File name pattern | `YYYY-MM-DD.log` |\n| Max file size | `20mb` |\n| Retention | `14 days` |\n| Archive | Gzip compressed |\n| Exception handling | Enabled (unhandled exceptions are logged) |\n| Exit on error | `false` (process stays alive on handled exceptions) |\n| File format | JSON + timestamp + error stack |\n\n**Customizing**\n\nThe package does not expose configuration options. To customize transports, formats, or log paths, wrap or fork the logger:\n\n```ts\nimport { createLogger, transports, format } from 'winston'\nimport 'winston-daily-rotate-file'\n\nexport const logger = createLogger({\n    transports: [\n        new transports.DailyRotateFile({\n            filename: 'logs/%DATE%.log',\n            datePattern: 'YYYY-MM-DD',\n            maxSize: '50m',\n            maxFiles: '30d',\n            format: format.combine(format.timestamp(), format.json())\n        })\n    ]\n})\n```",
	patterns: "## Common Patterns\n\n### Request logging middleware (Express)\n```ts\nimport { logger } from '@qnx/winston'\n\napp.use((req, res, next) => {\n    logger.http(`${req.method} ${req.url}`, {\n        ip: req.ip,\n        userAgent: req.headers['user-agent']\n    })\n    next()\n})\n```\n\n### Error logging in try/catch\n```ts\nimport { logger } from '@qnx/winston'\n\ntry {\n    await riskyOperation()\n} catch (error) {\n    logger.error('Operation failed', { error })\n}\n```\n\n### Logging inside asyncValidatorHandler (@qnx/response)\n```ts\nimport { asyncValidatorHandler } from '@qnx/response'\nimport { logger } from '@qnx/winston'\n\nrouter.post('/items', asyncValidatorHandler(async (req) => {\n    logger.info('Creating item', { body: req.body })\n    const item = await createItem(req.body)\n    logger.info('Item created', { id: item.id })\n    return item\n}))\n```\n\n### Logging with structured metadata\n```ts\nlogger.info('Payment processed', {\n    userId: 123,\n    amount: 49.99,\n    currency: 'USD',\n    transactionId: 'txn_abc123'\n})\n```"
};
function b(e) {
	e.registerTool("get-file-logger-docs", {
		description: "Get documentation for @qnx/winston — zero-config Winston logger that writes structured JSON to daily-rotating files. Use when you need persistent, production-grade file logging with automatic retention and archiving. Pass \"all\" for the full reference.",
		inputSchema: { topic: l.enum(v).describe("usage | levels | output | configuration | patterns | all") }
	}, async ({ topic: e }) => {
		let t;
		return t = e === "all" ? [
			"# `@qnx/winston` Reference\n",
			y.usage,
			y.levels,
			y.output,
			y.configuration,
			y.patterns
		].join("\n\n---\n\n") : y[e], { content: [{
			type: "text",
			text: t
		}] };
	});
}
//#endregion
//#region src/lib/tools/build-log-entry.tool.ts
var ee = [
	"error",
	"warn",
	"info",
	"http",
	"verbose",
	"debug",
	"silly"
], te = {
	error: "Failures that need attention",
	warn: "Recoverable issues or deprecations",
	info: "General operational events",
	http: "HTTP request/response logging",
	verbose: "Detailed flow tracing",
	debug: "Development diagnostics",
	silly: "Extremely verbose noise"
};
function x(e) {
	e.registerTool("build-file-log-entry", {
		description: [
			"Preview what a @qnx/winston log entry looks like when written to the log file, and get the corresponding logger call.",
			"",
			"Required params per level:",
			"  error   → message (required), metadata (optional, include { error } for stack trace)",
			"  warn    → message (required), metadata (optional)",
			"  info    → message (required), metadata (optional)",
			"  http    → message (required), metadata (optional)",
			"  verbose → message (required), metadata (optional)",
			"  debug   → message (required), metadata (optional)",
			"  silly   → message (required), metadata (optional)"
		].join("\n"),
		inputSchema: {
			level: l.enum(ee).describe("error | warn | info | http | verbose | debug | silly"),
			message: l.string().describe("The log message"),
			metadata: l.record(l.string(), l.unknown()).optional().describe("Optional structured metadata to attach (e.g. { userId: 1, error: err })")
		}
	}, async ({ level: e, message: t, metadata: n }) => {
		let r = {
			level: e,
			message: t,
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			...n
		};
		n && "error" in n && (r.stack = `Error: ${t}\n    at yourFunction (your-file.ts:10:5)`);
		let i = `import { logger } from '@qnx/winston'\n\nlogger.${e}('${t}'${n && Object.keys(n).length > 0 ? `, ${JSON.stringify(n)}` : ""})`, a = {
			level: e,
			description: te[e],
			fileEntry: r,
			snippet: i
		};
		return { content: [{
			type: "text",
			text: JSON.stringify(a, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/console-log-docs.tool.ts
var S = [
	"usage",
	"types",
	"patterns",
	"all"
], C = {
	usage: "## Usage\n\n**Installation**\n```bash\nnpm install @qnx/log chalk\n```\n\n**Import**\n```ts\nimport { consoleLog } from '@qnx/log'\n```\n\n**Basic examples**\n```ts\nconsoleLog('Server started', { type: 'info' })\nconsoleLog('An error occurred!', { type: 'error' })\nconsoleLog('Operation successful', { type: 'success' })\nconsoleLog('Proceed with caution', { type: 'warning' })\n```\n\n> The `type` option defaults to `'info'` if omitted:\n```ts\nconsoleLog('This is an informational message')\n```",
	types: "## Message Types\n\n| Type | Color | When to use |\n| --- | --- | --- |\n| `info` | Cyan | General informational messages (default) |\n| `error` | Red | Errors and failures |\n| `success` | Green | Successful operations |\n| `warning` | Yellow | Warnings or things to be cautious about |\n\n**Signature**\n```ts\nconsoleLog(message: string, { type }: { type: 'info' | 'error' | 'success' | 'warning' } = { type: 'info' }): void\n```\n\n> Output is colorized in the terminal via [Chalk](https://www.npmjs.com/package/chalk). No file output — console only.",
	patterns: "## Common Patterns\n\n### Startup messages\n```ts\nimport { consoleLog } from '@qnx/log'\n\nconsoleLog('Server started on port 3000', { type: 'success' })\nconsoleLog('Connected to database', { type: 'success' })\nconsoleLog('Running in development mode', { type: 'warning' })\n```\n\n### Script feedback\n```ts\nconsoleLog('Starting migration...', { type: 'info' })\nconsoleLog('Migration complete', { type: 'success' })\n```\n\n### Error reporting\n```ts\ntry {\n    await riskyOperation()\n    consoleLog('Operation completed', { type: 'success' })\n} catch (err) {\n    consoleLog(`Operation failed: ${err.message}`, { type: 'error' })\n}\n```\n\n### When to use @qnx/log vs @qnx/winston\n| Scenario | Use |\n| --- | --- |\n| Development feedback, CLI scripts, startup messages | `@qnx/log` |\n| Production logging, persistent records, file rotation | `@qnx/winston` |"
};
function w(e) {
	e.registerTool("get-console-log-docs", {
		description: "Get documentation for @qnx/log — lightweight colorized terminal output for development, CLI scripts, and startup messages. Use instead of @qnx/winston when you need visible terminal feedback without file persistence. Pass \"all\" for the full reference.",
		inputSchema: { topic: l.enum(S).describe("usage | types | patterns | all") }
	}, async ({ topic: e }) => {
		let t;
		return t = e === "all" ? [
			"# `@qnx/log` Reference\n",
			C.usage,
			C.types,
			C.patterns
		].join("\n\n---\n\n") : C[e], { content: [{
			type: "text",
			text: t
		}] };
	});
}
//#endregion
//#region src/lib/tools/build-console-log.tool.ts
var T = [
	"info",
	"error",
	"success",
	"warning"
], E = {
	info: "cyan",
	error: "red",
	success: "green",
	warning: "yellow"
};
function D(e) {
	e.registerTool("build-console-log", {
		description: "Preview what a @qnx/log console output looks like and get the corresponding consoleLog() call.",
		inputSchema: {
			type: l.enum(T).describe("info | error | success | warning"),
			message: l.string().describe("The message to log")
		}
	}, async ({ type: e, message: t }) => {
		let n = {
			type: e,
			color: E[e],
			consoleOutput: `[${E[e].toUpperCase()}] ${t}`,
			snippet: e === "info" ? `import { consoleLog } from '@qnx/log'\n\nconsoleLog('${t}')` : `import { consoleLog } from '@qnx/log'\n\nconsoleLog('${t}', { type: '${e}' })`
		};
		return { content: [{
			type: "text",
			text: JSON.stringify(n, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/client-docs.tool.ts
var O = [
	"classes",
	"api-response",
	"success-response",
	"error-response",
	"types",
	"patterns",
	"all"
], k = {
	classes: "## Classes Overview\n\n`@qnx/client` exports three response wrapper classes. Choose based on what the response contains:\n\n| Class | Use when | Required fields |\n| --- | --- | --- |\n| `ApiResponse<T>` | You don't know if the response is success or error | None — all fields optional |\n| `ApiSuccessResponse<T>` | You are certain the response is a success | `data` + `message` |\n| `ApiErrorResponse` | You are certain the response is an error | `error` + `errors` |\n\n**Import**\n```ts\nimport { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from '@qnx/client'\n```\n\n> Use `ApiResponse` when wrapping a raw fetch/axios response before checking its shape.\n> Use `ApiSuccessResponse` / `ApiErrorResponse` only after you have confirmed the response type.",
	"api-response": "## `ApiResponse<T>`\n\nGeneral-purpose wrapper for any API response. All fields are optional — safe to use before knowing if the response succeeded or failed.\n\n**Constructor**\n```ts\nnew ApiResponse<T>(response?: ApiResponseValue<T>)\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getData()` | `T | undefined` | The response payload |\n| `getMessage()` | `string | undefined` | Human-readable success message |\n| `getError()` | `string | undefined` | Top-level error message |\n| `getErrors()` | `Record<string, string[]> | undefined` | Field-level validation errors |\n| `getErrorCode()` | `string | undefined` | Machine-readable error code |\n\n**Example**\n```ts\nimport { ApiResponse } from '@qnx/client'\n\nconst res = new ApiResponse({\n  data: { id: 1, name: 'Item' },\n  message: 'Fetched successfully.',\n  error: undefined,\n  errors: undefined,\n  errorCode: undefined\n})\n\nres.getData()      // { id: 1, name: 'Item' }\nres.getMessage()   // 'Fetched successfully.'\nres.getError()     // undefined\nres.getErrors()    // undefined\nres.getErrorCode() // undefined\n```\n\n**Error case**\n```ts\nconst res = new ApiResponse({\n  error: 'Validation failed',\n  errors: {\n    email: ['Email is required'],\n    name: ['Name must be at least 2 characters']\n  },\n  errorCode: 'ERR_VALIDATION'\n})\n\nres.getData()      // undefined\nres.getError()     // 'Validation failed'\nres.getErrors()    // { email: ['Email is required'], name: ['Name must be...'] }\nres.getErrorCode() // 'ERR_VALIDATION'\n```",
	"success-response": "## `ApiSuccessResponse<T>`\n\nWrapper for confirmed success responses. Both `data` and `message` are required.\n\n**Constructor**\n```ts\nnew ApiSuccessResponse<T>(response: ApiSuccessResponseValue<T>)\n// where ApiSuccessResponseValue<T> = { data: T, message: string }\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getData()` | `T` | The response payload (always defined) |\n| `getMessage()` | `string` | The success message (always defined) |\n\n> Unlike `ApiResponse`, both methods here return non-optional values — safe to use without null checks.\n\n**Example**\n```ts\nimport { ApiSuccessResponse } from '@qnx/client'\n\nconst res = new ApiSuccessResponse({\n  data: { id: 1, name: 'Item' },\n  message: 'Item created successfully.'\n})\n\nres.getData()    // { id: 1, name: 'Item' }\nres.getMessage() // 'Item created successfully.'\n```\n\n> **Important:** Only use `ApiSuccessResponse` after confirming the response has no error. If `data` or `message` may be absent, use `ApiResponse` instead.",
	"error-response": "## `ApiErrorResponse`\n\nWrapper for confirmed error responses. `error` and `errors` are required; `errorCode` is optional.\n\n**Constructor**\n```ts\nnew ApiErrorResponse(response: ApiErrorResponseValue)\n// where ApiErrorResponseValue = { error: string, errors: Record<string, string[]>, errorCode?: string }\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getError()` | `string` | Top-level error message (always defined) |\n| `getErrors()` | `Record<string, string[]> | undefined` | Field-level validation errors |\n| `getErrorCode()` | `string | undefined` | Machine-readable error code |\n\n**Example**\n```ts\nimport { ApiErrorResponse } from '@qnx/client'\n\nconst res = new ApiErrorResponse({\n  error: 'Validation failed',\n  errors: {\n    email: ['Email is required', 'Email format is invalid'],\n    password: ['Password must be at least 8 characters']\n  },\n  errorCode: 'ERR_VALIDATION'\n})\n\nres.getError()     // 'Validation failed'\nres.getErrors()    // { email: [...], password: [...] }\nres.getErrorCode() // 'ERR_VALIDATION'\n```\n\n**Without errorCode**\n```ts\nconst res = new ApiErrorResponse({\n  error: 'Something went wrong',\n  errors: {}\n})\n\nres.getErrorCode() // undefined\n```",
	types: "## TypeScript Types\n\n### `ApiResponseValue<T>`\nFull API response shape. All fields optional.\n\n```ts\nimport type { ApiResponseValue } from '@qnx/client'\n\ninterface ApiResponseValue<T = any> {\n  readonly data?: T\n  readonly errorCode?: string\n  readonly error?: string\n  readonly errors?: Record<string, string[]>\n  readonly message?: string\n  readonly serverError?: any\n}\n```\n\n### `ApiSuccessResponseValue<T>`\nStrict success shape. Both `data` and `message` are required.\n\n```ts\nimport type { ApiSuccessResponseValue } from '@qnx/client'\n\n// Equivalent to: { data: T, message: string }\ntype ApiSuccessResponseValue<T> = Pick<Required<ApiResponseValue<T>>, 'data' | 'message'>\n```\n\n### `ApiErrorResponseValue`\nStrict error shape. `error` and `errors` are required; `errorCode` optional.\n\n```ts\nimport type { ApiErrorResponseValue } from '@qnx/client'\n\n// Equivalent to: { error: string, errors: Record<string, string[]>, errorCode?: string }\ntype ApiErrorResponseValue = Pick<Required<ApiResponseValue>, 'errors' | 'error'>\n    & Pick<ApiResponseValue, 'errorCode'>\n```\n\n### Summary\n\n| Type | `data` | `message` | `error` | `errors` | `errorCode` |\n| --- | --- | --- | --- | --- | --- |\n| `ApiResponseValue<T>` | optional | optional | optional | optional | optional |\n| `ApiSuccessResponseValue<T>` | **required** | **required** | — | — | — |\n| `ApiErrorResponseValue` | — | — | **required** | **required** | optional |",
	patterns: "## Common Patterns\n\n### Wrapping a fetch response\n```ts\nimport { ApiResponse } from '@qnx/client'\n\nconst raw = await fetch('/api/users/1').then(r => r.json())\nconst res = new ApiResponse(raw)\n\nif (res.getError()) {\n  console.error(res.getError())\n  console.error(res.getErrors()) // field-level detail if available\n} else {\n  console.log(res.getData())\n  console.log(res.getMessage())\n}\n```\n\n### Wrapping an axios response\n```ts\nimport { ApiResponse } from '@qnx/client'\nimport axios from 'axios'\n\nconst { data } = await axios.get('/api/users/1')\nconst res = new ApiResponse(data)\n```\n\n### Using typed success response\n```ts\nimport { ApiSuccessResponse } from '@qnx/client'\n\ntype User = { id: number; name: string }\n\nasync function createUser(payload: unknown) {\n  const raw = await fetch('/api/users', {\n    method: 'POST',\n    body: JSON.stringify(payload)\n  }).then(r => r.json())\n\n  const res = new ApiSuccessResponse<User>(raw)\n  return res.getData()  // typed as User — no undefined check needed\n}\n```\n\n### Handling validation errors\n```ts\nimport { ApiErrorResponse } from '@qnx/client'\n\nconst raw = await fetch('/api/users', { method: 'POST', body: JSON.stringify(payload) })\n  .then(r => r.json())\n\nif (!raw.data) {\n  const err = new ApiErrorResponse(raw)\n  const fieldErrors = err.getErrors()\n\n  if (fieldErrors?.email) {\n    showFieldError('email', fieldErrors.email[0])\n  }\n}\n```\n\n### Typing response fields\n```ts\nimport type { ApiResponseValue, ApiSuccessResponseValue, ApiErrorResponseValue } from '@qnx/client'\n\n// Use as function parameter/return types\nfunction handleSuccess(res: ApiSuccessResponseValue<User>) {\n  return res.data // typed as User\n}\n\nfunction handleError(res: ApiErrorResponseValue) {\n  return res.errors // typed as Record<string, string[]>\n}\n```"
};
function A(e) {
	e.registerTool("get-client-docs", {
		description: "Get documentation for @qnx/client — TypeScript classes for consuming @qnx/response-shaped API responses. Gives type-safe access to data, messages, and field errors on the client side via ApiResponse, ApiSuccessResponse, and ApiErrorResponse. Pass \"all\" for the full reference.",
		inputSchema: { topic: l.enum(O).describe("classes | api-response | success-response | error-response | types | patterns | all") }
	}, async ({ topic: e }) => {
		let t;
		return t = e === "all" ? [
			"# `@qnx/client` Reference\n",
			k.classes,
			k["api-response"],
			k["success-response"],
			k["error-response"],
			k.types,
			k.patterns
		].join("\n\n---\n\n") : k[e], { content: [{
			type: "text",
			text: t
		}] };
	});
}
//#endregion
//#region src/lib/tools/build-client-response.tool.ts
var j = [
	"ApiResponse",
	"ApiSuccessResponse",
	"ApiErrorResponse"
], M = {
	ApiResponse: "All fields optional. Provide any combination of data, message, error, errors, errorCode.",
	ApiSuccessResponse: "Requires: data + message. No error fields.",
	ApiErrorResponse: "Requires: error + errors. errorCode is optional."
};
function N(e) {
	e.registerTool("build-client-response", {
		description: [
			"Instantiate a @qnx/client response class with real values and show what each method returns.",
			"",
			"Required fields per responseClass:",
			"  ApiResponse        → all fields optional (data, message, error, errors, errorCode)",
			"  ApiSuccessResponse → data (required) + message (required)",
			"  ApiErrorResponse   → error (required) + errors (required) + errorCode (optional)"
		].join("\n"),
		inputSchema: {
			responseClass: l.enum(j).describe("ApiResponse | ApiSuccessResponse | ApiErrorResponse"),
			data: l.unknown().optional().describe("ApiResponse / ApiSuccessResponse — the response payload"),
			message: l.string().optional().describe("ApiResponse / ApiSuccessResponse — success message"),
			error: l.string().optional().describe("ApiResponse / ApiErrorResponse — top-level error message"),
			errors: l.record(l.string(), l.array(l.string())).optional().describe("ApiResponse / ApiErrorResponse — field-level validation errors"),
			errorCode: l.string().optional().describe("ApiResponse / ApiErrorResponse — machine-readable error code")
		}
	}, async ({ responseClass: e, data: t, message: n, error: r, errors: i, errorCode: a }) => {
		if (e === "ApiSuccessResponse") {
			if (t === void 0) return { content: [{
				type: "text",
				text: `Error: ApiSuccessResponse requires "data". ${M.ApiSuccessResponse}`
			}] };
			if (!n) return { content: [{
				type: "text",
				text: `Error: ApiSuccessResponse requires "message". ${M.ApiSuccessResponse}`
			}] };
			let r = {
				responseClass: e,
				input: {
					data: t,
					message: n
				},
				methods: {
					getData: t,
					getMessage: n
				},
				snippet: [
					"import { ApiSuccessResponse } from '@qnx/client'",
					"",
					`const res = new ApiSuccessResponse({ data: ${JSON.stringify(t)}, message: '${n}' })`,
					"",
					`res.getData()    // ${JSON.stringify(t)}`,
					`res.getMessage() // '${n}'`
				].join("\n")
			};
			return { content: [{
				type: "text",
				text: JSON.stringify(r, null, 2)
			}] };
		}
		if (e === "ApiErrorResponse") {
			if (!r) return { content: [{
				type: "text",
				text: `Error: ApiErrorResponse requires "error". ${M.ApiErrorResponse}`
			}] };
			if (!i) return { content: [{
				type: "text",
				text: `Error: ApiErrorResponse requires "errors". ${M.ApiErrorResponse}`
			}] };
			let t = {
				responseClass: e,
				input: {
					error: r,
					errors: i,
					errorCode: a ?? void 0
				},
				methods: {
					getError: r,
					getErrors: i,
					getErrorCode: a ?? void 0
				},
				snippet: [
					"import { ApiErrorResponse } from '@qnx/client'",
					"",
					`const res = new ApiErrorResponse(${JSON.stringify({
						error: r,
						errors: i,
						...a ? { errorCode: a } : {}
					}, null, 2)})`,
					"",
					`res.getError()     // '${r}'`,
					`res.getErrors()    // ${JSON.stringify(i)}`,
					`res.getErrorCode() // ${a ? `'${a}'` : "undefined"}`
				].join("\n")
			};
			return { content: [{
				type: "text",
				text: JSON.stringify(t, null, 2)
			}] };
		}
		let o = {
			...t !== void 0 && { data: t },
			...n && { message: n },
			...r && { error: r },
			...i && { errors: i },
			...a && { errorCode: a }
		}, s = {
			responseClass: e,
			input: o,
			methods: {
				getData: t ?? null,
				getMessage: n ?? null,
				getError: r ?? null,
				getErrors: i ?? null,
				getErrorCode: a ?? null
			},
			snippet: [
				"import { ApiResponse } from '@qnx/client'",
				"",
				`const res = new ApiResponse(${JSON.stringify(o, null, 2)})`,
				"",
				`res.getData()      // ${t === void 0 ? "undefined" : JSON.stringify(t)}`,
				`res.getMessage()   // ${n ? `'${n}'` : "undefined"}`,
				`res.getError()     // ${r ? `'${r}'` : "undefined"}`,
				`res.getErrors()    // ${i ? JSON.stringify(i) : "undefined"}`,
				`res.getErrorCode() // ${a ? `'${a}'` : "undefined"}`
			].join("\n")
		};
		return { content: [{
			type: "text",
			text: JSON.stringify(s, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/crypto-docs.tool.ts
var P = [
	"overview",
	"jwt",
	"jwe",
	"auth-token",
	"key-helpers",
	"algorithms",
	"all"
], F = {
	overview: "## Overview\n\n`@qnx/crypto` provides JWT signing/verification and JWE encryption/decryption built on the [jose](https://github.com/panva/jose) library.\n\n**Installation**\n```bash\nnpm install @qnx/crypto jose\n```\n\n**Two usage levels**\n\n| Level | Functions | Keys |\n| --- | --- | --- |\n| Core | `jwtSign`, `jwtVerify`, `jweEncrypt`, `jweDecrypt` | You provide the key |\n| Auth token | `generateAuthToken`, `decryptAuthToken` | Loaded automatically from env vars |\n\n**All exports**\n```ts\nimport {\n  // Core JWT\n  jwtSign, jwtVerify,\n  // Core JWE\n  jweEncrypt, jweDecrypt,\n  // Auth token (high-level)\n  generateAuthToken, decryptAuthToken,\n  // Key helpers\n  toSymmetricSecret, toPKCS8Secret, toSPKISecret, toJWKSecret\n} from '@qnx/crypto'\n```\n\n> **Note:** `jwtVerify` is re-exported directly from `jose` — same API, no wrapper.",
	jwt: "## JWT — Sign & Verify\n\n### `jwtSign`\n\nSigns a JWT and returns the compact string.\n\n**Signature**\n```ts\njwtSign(\n  payload: JWTPayload,\n  key: CryptoKey | KeyObject | JWK | Uint8Array,\n  options?: {\n    alg?: string           // default: 'ES256'\n    jti?: string           // JWT ID\n    subject?: string       // sub claim\n    issuer?: string        // iss claim\n    expirationTime?: string | number | Date  // e.g. '2h', '7d'\n  }\n): Promise<string>\n```\n\n**With symmetric secret (HS256)**\n```ts\nimport { jwtSign, toSymmetricSecret } from '@qnx/crypto'\n\nconst secret = toSymmetricSecret('your-secret-string')\nconst token = await jwtSign({ userId: 42 }, secret, {\n  alg: 'HS256',\n  subject: '42',\n  expirationTime: '2h'\n})\n```\n\n**With asymmetric key (ES256)**\n```ts\nimport { jwtSign, toPKCS8Secret } from '@qnx/crypto'\n\nconst privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY, 'ES256')\nconst token = await jwtSign({ userId: 42 }, privateKey, {\n  subject: '42',\n  issuer: 'https://yourapp.com',\n  expirationTime: '7d'\n})\n```\n\n---\n\n### `jwtVerify`\n\nVerifies the JWT signature and claims. Re-exported from `jose`.\n\n**Signature**\n```ts\njwtVerify(token: string, key: CryptoKey | KeyObject | JWK | Uint8Array): Promise<{ payload: JWTPayload, protectedHeader: ... }>\n```\n\n**With symmetric secret**\n```ts\nimport { jwtVerify, toSymmetricSecret } from '@qnx/crypto'\n\nconst secret = toSymmetricSecret('your-secret-string')\nconst { payload } = await jwtVerify(token, secret)\nconsole.log(payload) // { userId: 42, sub: '42', iat: ..., exp: ... }\n```\n\n**With asymmetric key**\n```ts\nimport { jwtVerify, toSPKISecret } from '@qnx/crypto'\n\nconst publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY, 'ES256')\nconst { payload } = await jwtVerify(token, publicKey)\n```\n\n> Throws if the token is expired, has an invalid signature, or fails any claims check.",
	jwe: "## JWE — Encrypt & Decrypt\n\n### `jweEncrypt`\n\nEncrypts a plaintext string into a compact JWE.\n\n**Signature**\n```ts\njweEncrypt(\n  plaintext: string,\n  key: CryptoKey | KeyObject | JWK | Uint8Array,\n  options?: { alg?: string; enc?: string }\n): Promise<string>\n```\n\n| Option | Default | Description |\n| --- | --- | --- |\n| `alg` | `ECDH-ES+A128KW` | Key agreement algorithm |\n| `enc` | `A256CBC-HS512` | Content encryption algorithm |\n\n**Example**\n```ts\nimport { jweEncrypt, toSPKISecret } from '@qnx/crypto'\n\nconst publicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY, 'ECDH-ES+A128KW')\nconst jwe = await jweEncrypt('sensitive data', publicKey)\n```\n\n---\n\n### `jweDecrypt`\n\nDecrypts a compact JWE and returns the plaintext string.\n\n**Signature**\n```ts\njweDecrypt(\n  jwe: string,\n  key: CryptoKey | KeyObject | JWK | Uint8Array,\n  options?: DecryptOptions\n): Promise<{ plaintext: string; protectedHeader: CompactJWEHeaderParameters }>\n```\n\n**Example**\n```ts\nimport { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'\n\nconst privateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY, 'ECDH-ES+A128KW')\nconst { plaintext } = await jweDecrypt(jwe, privateKey)\nconsole.log(plaintext) // 'sensitive data'\n```\n\n> `jweDecrypt` decodes the Uint8Array output from `compactDecrypt` back to a string automatically — you get a plain `string`, not a `Uint8Array`.",
	"auth-token": "## Auth Token (High-Level)\n\nHigh-level helpers that combine JWT + JWE. Keys are loaded automatically from environment variables.\n\n### Environment Variables (required)\n\n```bash\nJWT_PRIVATE_KEY=<ES256 PKCS8 PEM>   # used to sign the JWT\nJWT_PUBLIC_KEY=<ES256 SPKI PEM>     # used to verify the JWT\nJWE_PUBLIC_KEY=<ECDH-ES+A128KW SPKI PEM>   # used to encrypt the JWE\nJWE_PRIVATE_KEY=<ECDH-ES+A128KW PKCS8 PEM> # used to decrypt the JWE\n```\n\n---\n\n### `generateAuthToken`\n\nSigns a JWT with the subject, then encrypts it as a JWE. Returns both the encrypted token and a UUID for DB storage.\n\n**Signature**\n```ts\ngenerateAuthToken(subject: string): Promise<{ token: string; dbToken: string }>\n```\n\n| Return field | Description |\n| --- | --- |\n| `token` | The JWE-encrypted token — send this to the client |\n| `dbToken` | A UUID (JWT ID / `jti`) — store this in the database to track/revoke sessions |\n\n**Example**\n```ts\nimport { generateAuthToken } from '@qnx/crypto'\n\nconst { token, dbToken } = await generateAuthToken(userId.toString())\n\n// Store dbToken in DB, send token to client\nawait db.sessions.create({ jti: dbToken, userId })\nres.cookie('auth', token, { httpOnly: true })\n```\n\n---\n\n### `decryptAuthToken`\n\nDecrypts the JWE, then verifies the inner JWT. Returns the JWT payload.\n\n\n**Signature**\n```ts\ndecryptAuthToken(jwe: string): Promise<JWTPayload>\n```\n\n**Example**\n```ts\nimport { decryptAuthToken } from '@qnx/crypto'\n\ntry {\n  const payload = await decryptAuthToken(req.cookies.auth)\n  const userId = payload.sub   // the subject passed to generateAuthToken\n  const jti = payload.jti      // match this against your DB to validate the session\n} catch (error) {\n  // Token is invalid, expired, or tampered\n  throw new UnauthenticatedUserError('Invalid auth token')\n}\n```\n\n---\n\n### Flow\n\n```\ngenerateAuthToken(subject)\n  → jwtSign({}, jwtPrivateKey, { jti, subject })   // creates JWT\n  → jweEncrypt(jwt, jwePublicKey)                   // wraps JWT in JWE\n  → returns { token: jwe, dbToken: jti }\n\ndecryptAuthToken(jwe)\n  → jweDecrypt(jwe, jwePrivateKey)                  // unwraps JWE → JWT string\n  → jwtVerify(jwt, jwtPublicKey)                    // verifies JWT\n  → returns payload { sub, jti, iat, ... }\n```",
	"key-helpers": "## Key Helpers\n\nUtility functions to convert raw key material into the format expected by `jwtSign`, `jwtVerify`, `jweEncrypt`, and `jweDecrypt`.\n\n### `toSymmetricSecret`\n\nEncodes a plain string into a `Uint8Array` for use as an HMAC symmetric secret (e.g. HS256).\n\n```ts\nimport { toSymmetricSecret } from '@qnx/crypto'\n\nconst secret = toSymmetricSecret('my-secret-string')\n// Returns: Uint8Array — pass directly to jwtSign / jwtVerify\n```\n\n> Use for symmetric JWT (HS256, HS384, HS512). Do NOT use for JWE or asymmetric JWT.\n\n---\n\n### `toPKCS8Secret`\n\nImports a PKCS8 PEM private key. Alias for `jose.importPKCS8`.\n\n```ts\nimport { toPKCS8Secret } from '@qnx/crypto'\n\nconst privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY, 'ES256')\n// or for JWE decryption:\nconst jwePrivateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY, 'ECDH-ES+A128KW')\n```\n\n---\n\n### `toSPKISecret`\n\nImports a SPKI PEM public key. Alias for `jose.importSPKI`.\n\n```ts\nimport { toSPKISecret } from '@qnx/crypto'\n\nconst publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY, 'ES256')\n// or for JWE encryption:\nconst jwePublicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY, 'ECDH-ES+A128KW')\n```\n\n---\n\n### `toJWKSecret`\n\nImports a JWK (JSON Web Key). Alias for `jose.importJWK`.\n\n```ts\nimport { toJWKSecret } from '@qnx/crypto'\n\nconst key = await toJWKSecret({ kty: 'EC', crv: 'P-256', ... })\n```\n\n---\n\n### Summary\n\n| Helper | Input | Use with |\n| --- | --- | --- |\n| `toSymmetricSecret` | Plain string | `jwtSign` / `jwtVerify` (HS256) |\n| `toPKCS8Secret` | PKCS8 PEM string | `jwtSign` (private), `jweDecrypt` (private) |\n| `toSPKISecret` | SPKI PEM string | `jwtVerify` (public), `jweEncrypt` (public) |\n| `toJWKSecret` | JWK object | Any operation with a JWK key |",
	algorithms: "## Algorithms\n\n### JWT Algorithms\n\n| Algorithm | Type | Key helper | Use when |\n| --- | --- | --- | --- |\n| `HS256` | Symmetric HMAC | `toSymmetricSecret` | Same party signs and verifies (e.g. internal services) |\n| `HS384` | Symmetric HMAC | `toSymmetricSecret` | Same as HS256, stronger hash |\n| `HS512` | Symmetric HMAC | `toSymmetricSecret` | Same as HS256, strongest hash |\n| `ES256` *(default)* | Asymmetric EC | `toPKCS8Secret` / `toSPKISecret` | Different parties sign (private) and verify (public) |\n| `RS256` | Asymmetric RSA | `toPKCS8Secret` / `toSPKISecret` | RSA alternative to ES256 |\n\n### JWE Algorithms\n\n| Option | Default | Description |\n| --- | --- | --- |\n| `alg` (key wrap) | `ECDH-ES+A128KW` | Key agreement + wrapping algorithm |\n| `enc` (content) | `A256CBC-HS512` | Content encryption algorithm |\n\n**Common `alg` values**\n| Algorithm | Key type |\n| --- | --- |\n| `ECDH-ES+A128KW` *(default)* | EC key pair (SPKI to encrypt, PKCS8 to decrypt) |\n| `A128KW` / `A256KW` | Symmetric AES key |\n| `RSA-OAEP` | RSA key pair |\n\n**Common `enc` values**\n| Algorithm | Description |\n| --- | --- |\n| `A256CBC-HS512` *(default)* | AES-256-CBC + HMAC-SHA-512 |\n| `A128GCM` / `A256GCM` | AES-GCM authenticated encryption |"
};
function I(e) {
	e.registerTool("get-crypto-docs", {
		description: "Get documentation for @qnx/crypto — auth token generation and JWT/JWE helpers built on jose. Use generateAuthToken/decryptAuthToken for session management, or the core jwtSign/jwtVerify/jweEncrypt/jweDecrypt functions for custom flows. Pass \"all\" for the full reference.",
		inputSchema: { topic: l.enum(P).describe("overview | jwt | jwe | auth-token | key-helpers | algorithms | all") }
	}, async ({ topic: e }) => {
		let t;
		return t = e === "all" ? [
			"# `@qnx/crypto` Reference\n",
			F.overview,
			F.jwt,
			F.jwe,
			F["auth-token"],
			F["key-helpers"],
			F.algorithms
		].join("\n\n---\n\n") : F[e], { content: [{
			type: "text",
			text: t
		}] };
	});
}
//#endregion
//#region src/lib/tools/build-crypto-snippet.tool.ts
var L = [
	"jwt-sign",
	"jwt-verify",
	"jwe-encrypt",
	"jwe-decrypt",
	"auth-token-generate",
	"auth-token-decrypt"
], R = ["symmetric", "asymmetric"], z = {
	"jwt-sign": "Requires: keyType. Optional: payload, alg, subject, issuer, expirationTime, jti.",
	"jwt-verify": "Requires: keyType.",
	"jwe-encrypt": "Requires: plaintext. Optional: alg, enc.",
	"jwe-decrypt": "Optional: alg.",
	"auth-token-generate": "Requires: subject.",
	"auth-token-decrypt": "No extra params needed — keys loaded from env vars automatically."
};
function B(e) {
	e.registerTool("build-crypto-snippet", {
		description: [
			"Generate a ready-to-use TypeScript code snippet for a @qnx/crypto operation with correct imports, key setup, and function call.",
			"",
			"Required params per operation:",
			"  jwt-sign            → keyType (symmetric | asymmetric)",
			"  jwt-verify          → keyType (symmetric | asymmetric)",
			"  jwe-encrypt         → plaintext",
			"  jwe-decrypt         → (no required params)",
			"  auth-token-generate → subject",
			"  auth-token-decrypt  → (no required params)"
		].join("\n"),
		inputSchema: {
			operation: l.enum(L).describe("jwt-sign | jwt-verify | jwe-encrypt | jwe-decrypt | auth-token-generate | auth-token-decrypt"),
			keyType: l.enum(R).optional().describe("jwt-sign / jwt-verify only — symmetric (HS256, uses toSymmetricSecret) | asymmetric (ES256, uses PKCS8/SPKI keys)"),
			payload: l.record(l.string(), l.unknown()).optional().describe("jwt-sign only — JWT claims payload (e.g. { userId: 42 })"),
			alg: l.string().optional().describe("jwt-sign: override algorithm (default ES256 or HS256). jwe-encrypt/decrypt: key wrap algorithm (default ECDH-ES+A128KW)"),
			enc: l.string().optional().describe("jwe-encrypt only — content encryption algorithm (default A256CBC-HS512)"),
			subject: l.string().optional().describe("jwt-sign / auth-token-generate — the sub claim or user identifier"),
			issuer: l.string().optional().describe("jwt-sign only — the iss claim (e.g. \"https://yourapp.com\")"),
			expirationTime: l.string().optional().describe("jwt-sign only — expiration (e.g. \"2h\", \"7d\", \"30m\")"),
			jti: l.string().optional().describe("jwt-sign only — JWT ID for token tracking/revocation"),
			plaintext: l.string().optional().describe("jwe-encrypt only — the string to encrypt")
		}
	}, async ({ operation: e, keyType: t, payload: n, alg: r, enc: i, subject: a, issuer: o, expirationTime: s, jti: c, plaintext: l }) => {
		let u, d = [];
		if (e === "jwt-sign") {
			if (!t) return { content: [{
				type: "text",
				text: `Error: jwt-sign requires "keyType". ${z["jwt-sign"]}`
			}] };
			let e = n ? JSON.stringify(n) : "{ userId: 42 }", i = {};
			t === "symmetric" && (i.alg = r ?? "HS256"), a && (i.subject = a), o && (i.issuer = o), s && (i.expirationTime = s), c && (i.jti = c);
			let l = Object.keys(i).length > 0 ? `, ${JSON.stringify(i)}` : "";
			u = t === "symmetric" ? [
				"import { jwtSign, toSymmetricSecret } from '@qnx/crypto'",
				"",
				"const secret = toSymmetricSecret(process.env.JWT_SECRET)",
				`const token = await jwtSign(${e}, secret${l})`
			].join("\n") : [
				"import { jwtSign, toPKCS8Secret } from '@qnx/crypto'",
				"",
				`const privateKey = await toPKCS8Secret(process.env.JWT_PRIVATE_KEY, '${r ?? "ES256"}')`,
				`const token = await jwtSign(${e}, privateKey${l})`
			].join("\n");
		} else if (e === "jwt-verify") {
			if (!t) return { content: [{
				type: "text",
				text: `Error: jwt-verify requires "keyType". ${z["jwt-verify"]}`
			}] };
			u = t === "symmetric" ? [
				"import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'",
				"",
				"const secret = toSymmetricSecret(process.env.JWT_SECRET)",
				"const { payload } = await jwtVerify(token, secret)"
			].join("\n") : [
				"import { jwtVerify, toSPKISecret } from '@qnx/crypto'",
				"",
				`const publicKey = await toSPKISecret(process.env.JWT_PUBLIC_KEY, '${r ?? "ES256"}')`,
				"const { payload } = await jwtVerify(token, publicKey)"
			].join("\n"), d.push("jwtVerify throws if the token is expired, has an invalid signature, or fails claims checks — wrap in try/catch.");
		} else if (e === "jwe-encrypt") {
			if (!l) return { content: [{
				type: "text",
				text: `Error: jwe-encrypt requires "plaintext". ${z["jwe-encrypt"]}`
			}] };
			let e = r || i ? `, { alg: '${r ?? "ECDH-ES+A128KW"}', enc: '${i ?? "A256CBC-HS512"}' }` : "";
			u = [
				"import { jweEncrypt, toSPKISecret } from '@qnx/crypto'",
				"",
				`const publicKey = await toSPKISecret(process.env.JWE_PUBLIC_KEY, '${r ?? "ECDH-ES+A128KW"}')`,
				`const jwe = await jweEncrypt('${l}'${e ? `, publicKey${e}` : ", publicKey"})`
			].join("\n");
		} else if (e === "jwe-decrypt") u = [
			"import { jweDecrypt, toPKCS8Secret } from '@qnx/crypto'",
			"",
			`const privateKey = await toPKCS8Secret(process.env.JWE_PRIVATE_KEY, '${r ?? "ECDH-ES+A128KW"}')`,
			"const { plaintext } = await jweDecrypt(jwe, privateKey)"
		].join("\n"), d.push("plaintext is returned as a string — jweDecrypt decodes the Uint8Array automatically.");
		else if (e === "auth-token-generate") {
			if (!a) return { content: [{
				type: "text",
				text: `Error: auth-token-generate requires "subject". ${z["auth-token-generate"]}`
			}] };
			u = [
				"import { generateAuthToken } from '@qnx/crypto'",
				"",
				`const { token, dbToken } = await generateAuthToken('${a}')`,
				"",
				"// token   → JWE-encrypted token, send to client",
				"// dbToken → UUID (jti), store in DB to track/revoke sessions"
			].join("\n"), d.push("Requires env vars: JWT_PRIVATE_KEY, JWE_PUBLIC_KEY.");
		} else u = [
			"import { decryptAuthToken } from '@qnx/crypto'",
			"",
			"try {",
			"  const payload = await decryptAuthToken(token)",
			"  const userId = payload.sub   // subject passed to generateAuthToken",
			"  const jti = payload.jti      // match against DB to validate session",
			"} catch (error) {",
			"  // token is invalid, expired, or tampered",
			"}"
		].join("\n"), d.push("Requires env vars: JWT_PUBLIC_KEY, JWE_PRIVATE_KEY.");
		let f = {
			operation: e,
			snippet: u,
			...d.length > 0 && { notes: d }
		};
		return { content: [{
			type: "text",
			text: JSON.stringify(f, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/list-mcp-tools.tool.ts
var V = "# QNX MCP Server — Available Tools\n\n## `@qnx/errors`\n| Tool | Type | Purpose |\n| --- | --- | --- |\n| `get-error-class-docs` | docs | Constructor signature, methods, examples, and when to use each error class |\n| `build-api-error` | build | Instantiate an error class with real values — preview resolved code + errorResponse |\n\n## `@qnx/response`\n| Tool | Type | Purpose |\n| --- | --- | --- |\n| `get-response-docs` | docs | Code examples for handler setup, success, validation errors, Zod, unauthenticated, resource routes |\n| `build-api-response` | build | Show HTTP status code, response body shape, and which @qnx/response function produces it |\n\n## `@qnx/client`\n| Tool | Type | Purpose |\n| --- | --- | --- |\n| `get-client-docs` | docs | ApiResponse, ApiSuccessResponse, ApiErrorResponse classes, TypeScript types, and usage patterns |\n| `build-client-response` | build | Instantiate a response class with real values — see what each method returns |\n\n## `@qnx/crypto`\n| Tool | Type | Purpose |\n| --- | --- | --- |\n| `get-crypto-docs` | docs | JWT, JWE, auth token helpers, key helpers, and supported algorithms |\n| `build-crypto-snippet` | build | Generate a TypeScript snippet for jwt-sign, jwt-verify, jwe-encrypt, jwe-decrypt, auth-token-generate, auth-token-decrypt |\n\n## `@qnx/winston` (file logger)\n| Tool | Type | Purpose |\n| --- | --- | --- |\n| `get-file-logger-docs` | docs | Usage, log levels, file output format, configuration, and patterns |\n| `build-file-log-entry` | build | Preview the JSON log entry written to file for a given level, message, and metadata |\n\n## `@qnx/log` (console logger)\n| Tool | Type | Purpose |\n| --- | --- | --- |\n| `get-console-log-docs` | docs | Usage, message types (info/error/success/warning), and patterns |\n| `build-console-log` | build | Preview console output and get the consoleLog() call |\n\n---\n\n## Tool Types\n| Type | When to use |\n| --- | --- |\n| `docs` | Get documentation, examples, and API reference for a package |\n| `build` | Instantiate or generate with real values — preview output or get a ready-to-paste code snippet |";
function H(e) {
	e.registerTool("list-mcp-tools", { description: "List all available QNX MCP tools grouped by package. Call this first to discover what tools are available before working with any @qnx/* package." }, async () => ({ content: [{
		type: "text",
		text: V
	}] }));
}
//#endregion
//#region src/lib/tools/build-api-response.tool.ts
var U = [
	"success",
	"validation-error",
	"invalid-value",
	"unauthenticated",
	"server-error"
], W = {
	success: {
		functions: ["initializeApiResponse", "ApiResponse.getInstance"],
		example: "return initializeApiResponse().setData(data).setMessage('Created successfully.')\n// or return raw value (auto-wrapped in { data: ... })\nreturn { id: 1, name: 'Item' }",
		imports: ["initializeApiResponse"]
	},
	"validation-error": {
		functions: ["invalidApiResponse", "throw ValidationError"],
		example: "const errors = ApiResponseErrorsValue.getInstance()\n    .addError('email', 'Email is required.')\n    .addError('name', 'Name is required.')\n    .getErrors()\nreturn invalidApiResponse(res, errors)",
		imports: ["invalidApiResponse", "ApiResponseErrorsValue"]
	},
	"invalid-value": {
		functions: [
			"invalidValueApiResponse",
			"throwInvalidValueApiResponse",
			"throw InvalidValueError"
		],
		example: "return invalidValueApiResponse(res, 'email', 'Email is required.')\n// or throw (caught by asyncValidatorHandler)\nthrowInvalidValueApiResponse('email', 'Email is required.')",
		imports: ["invalidValueApiResponse", "throwInvalidValueApiResponse"]
	},
	unauthenticated: {
		functions: ["unauthenticateApiResponse", "throw UnauthenticatedUserError"],
		example: "return unauthenticateApiResponse(res)\n// or throw (caught by asyncValidatorHandler)\nthrow new UnauthenticatedUserError('Not authenticated')",
		imports: ["unauthenticateApiResponse"]
	},
	"server-error": {
		functions: ["serverErrorApiResponse", "throw Error (auto-caught)"],
		example: "// Any unhandled error thrown inside asyncValidatorHandler produces this\nthrow new Error('Something went wrong')",
		imports: []
	}
};
function G(e) {
	e.registerTool("build-api-response", {
		description: [
			"Show the HTTP status code, exact response body shape, the @qnx/response function that produces it, and the required imports.",
			"Field usage per type:",
			"  success          → data (optional), message (optional)",
			"  validation-error → errors (required)",
			"  invalid-value    → field (required), error (required)",
			"  unauthenticated  → no extra fields",
			"  server-error     → error (optional)"
		].join("\n"),
		inputSchema: {
			type: l.enum(U).describe("success | validation-error | invalid-value | unauthenticated | server-error"),
			data: l.record(l.string(), l.unknown()).optional().describe("success only — response payload, wrapped as { data: ... }"),
			message: l.string().optional().describe("success only — human-readable success message"),
			errors: l.record(l.string(), l.array(l.string())).optional().describe("validation-error only (required) — field errors map: { fieldName: [\"error msg\"] }"),
			field: l.string().optional().describe("invalid-value only (required) — the name of the invalid field"),
			error: l.string().optional().describe("invalid-value | server-error only — the error message")
		}
	}, async ({ type: e, data: t, message: n, errors: r, field: i, error: a }) => {
		let o, s;
		if (e === "success") o = 200, s = {}, t !== void 0 && (s.data = t), n !== void 0 && (s.message = n);
		else if (e === "validation-error") {
			o = c.VALIDATION_ERROR_CODE;
			let e = r ? Object.values(r)[0]?.[0] ?? "" : "";
			s = {
				errors: r ?? {},
				error: e
			};
		} else if (e === "invalid-value") {
			o = c.VALIDATION_ERROR_CODE;
			let e = i ?? "field", t = a ?? "Invalid value";
			s = {
				errors: { [e]: [t] },
				error: t
			};
		} else e === "unauthenticated" ? (o = c.UNAUTHENTICATED_USER_ERROR_CODE, s = {
			errorCode: "unauthenticated",
			message: "Unauthenticated"
		}) : (o = c.SERVER_ERROR_CODE, s = { serverError: {
			name: "Error",
			message: a ?? "Internal server error",
			stack: "..."
		} });
		let l = {
			statusCode: o,
			body: s,
			producedBy: W[e]
		};
		return { content: [{
			type: "text",
			text: JSON.stringify(l, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/response-pattern.tool.ts
var K = [
	"async-handler",
	"success",
	"validation-error",
	"invalid-value",
	"throw-validation",
	"zod-validation",
	"unauthenticated",
	"resource-route"
], q = {
	"async-handler": {
		description: "Wrap any Express route with asyncValidatorHandler. It catches ValidationError, UnauthenticatedUserError, ZodError, and generic Error automatically and sends the correct response.",
		code: "import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'\n\nrouter.get('/items', asyncValidatorHandler(async (req, res) => {\n    return items // auto-wrapped as { data: items }\n}))\n\nrouter.post('/items', asyncValidatorHandler(async (req, res) => {\n    return initializeApiResponse().setData(newItem).setMessage('Item created successfully.')\n}))"
	},
	success: {
		description: "Return a success response (HTTP 200). Raw return values are auto-wrapped in { data: ... }. Use initializeApiResponse() to include a message or control the shape.",
		code: "import { initializeApiResponse, ApiResponse } from '@qnx/response'\n\n// Raw object → { data: { id: 1, name: 'Item' } }\nreturn { id: 1, name: 'Item' }\n\n// With message → { data: { id: 1 }, message: 'Created.' }\nreturn initializeApiResponse().setData({ id: 1 }).setMessage('Created.')\n\n// Custom status code\nreturn ApiResponse.getInstance().setStatusCode(201).setData(item)\n\n// Additional fields → { data: { id: 1 }, meta: { total: 10 } }\nreturn ApiResponse.getInstance()\n    .setData({ id: 1 })\n    .setAdditional({ meta: { total: 10 } })"
	},
	"validation-error": {
		description: "Return a validation error with multiple field errors. Status: VALIDATION_ERROR_CODE (default 400). Body: { errors: { field: [msg] }, error: firstMsg }",
		code: "import { invalidApiResponse, ApiResponseErrorsValue } from '@qnx/response'\n\nconst errors = ApiResponseErrorsValue.getInstance()\n    .addError('email', 'Email is required.')\n    .addError('name', 'Name must be at least 2 characters.')\n    .getErrors()\n\nreturn invalidApiResponse(res, errors)\n// → { errors: { email: ['Email is required.'], name: ['Name must be...'] }, error: 'Email is required.' }"
	},
	"invalid-value": {
		description: "Return a single-field validation error. Status: VALIDATION_ERROR_CODE (default 400). Body: { errors: { field: [msg] }, error: msg }",
		code: "import { invalidValueApiResponse } from '@qnx/response'\n\nreturn invalidValueApiResponse(res, 'email', 'Email is required.')\n// → { errors: { email: ['Email is required.'] }, error: 'Email is required.' }"
	},
	"throw-validation": {
		description: "Throw a validation error from anywhere inside asyncValidatorHandler — it is caught and the correct error response is sent automatically.",
		code: "import { throwInvalidValueApiResponse } from '@qnx/response'\nimport { ValidationError, InvalidValueError } from '@qnx/errors'\nimport { ApiResponseErrorsValue } from '@qnx/response'\n\n// Single field shorthand\nthrowInvalidValueApiResponse('email', 'Email is required.')\n\n// Single field via error class\nthrow new InvalidValueError('Email is required.', { key: 'email' })\n\n// Multiple fields\nconst errors = ApiResponseErrorsValue.getInstance()\n    .addError('email', 'Email is required.')\n    .addError('name', 'Name is required.')\n    .getErrors()\nthrow new ValidationError('Validation failed', { errRes: { errors } })"
	},
	"zod-validation": {
		description: "Use Zod schema parsing inside asyncValidatorHandler. ZodErrors are caught automatically and converted to { errors: { \"field.path\": [msg] }, error: firstMsg }. Nested paths use dot notation.",
		code: "import z from 'zod'\nimport { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'\n\nconst UserSchema = z.object({\n    name: z.string(),\n    email: z.string().email(),\n    addresses: z.array(z.string())\n})\n\nrouter.post('/users', asyncValidatorHandler(async (req) => {\n    const data = UserSchema.parse(req.body) // ZodError auto-caught → { errors: { email: [...] }, error: '...' }\n    return initializeApiResponse().setData(data).setMessage('User created successfully.')\n}))\n// Nested errors use dot notation: 'addresses.1', 'posts.0.tagUsers.2'"
	},
	unauthenticated: {
		description: "Return an unauthenticated response. Status: UNAUTHENTICATED_USER_ERROR_CODE (default 500). Body: { errorCode: \"unauthenticated\", message: \"Unauthenticated\" }",
		code: "import { unauthenticateApiResponse } from '@qnx/response'\nimport { UnauthenticatedUserError } from '@qnx/errors'\n\n// Direct response\nreturn unauthenticateApiResponse(res)\n\n// Or throw — asyncValidatorHandler catches UnauthenticatedUserError automatically\nthrow new UnauthenticatedUserError('Not authenticated')"
	},
	"resource-route": {
		description: "Register standard CRUD routes on an Express router. Each provided method is wrapped in asyncValidatorHandler automatically. Routes: GET /, GET /:id, POST /, PUT /:id, PUT /change-status/:id, DELETE /:id",
		code: "import { resourceRoute, initializeApiResponse } from '@qnx/response'\nimport { Router } from 'express'\n\nconst router = Router()\n\nresourceRoute(router, {\n    findAll:      async (req) => items,                                              // GET    /\n    findOne:      async (req) => item,                                               // GET    /:id\n    create:       async (req) => initializeApiResponse()                             // POST   /\n                      .setData(newItem).setMessage('Created successfully.'),\n    update:       async (req) => initializeApiResponse()                             // PUT    /:id\n                      .setData(updated).setMessage('Updated successfully.'),\n    changeStatus: async (req) => initializeApiResponse()                             // PUT    /change-status/:id\n                      .setMessage('Status updated.'),\n    remove:       async (req) => initializeApiResponse().setMessage('Deleted.')      // DELETE /:id\n})"
	}
};
function J(e) {
	e.registerTool("get-response-docs", {
		description: "Get documentation for @qnx/response — Express handler utilities that standardize HTTP response shapes. asyncValidatorHandler auto-catches @qnx/errors and ZodErrors; initializeApiResponse controls the success response body. Use this to understand the full response pattern.",
		inputSchema: { pattern: l.enum(K).describe("async-handler | success | validation-error | invalid-value | throw-validation | zod-validation | unauthenticated | resource-route") }
	}, async ({ pattern: e }) => {
		let { description: t, code: n } = q[e];
		return { content: [{
			type: "text",
			text: `## ${e}\n\n${t}\n\n\`\`\`typescript\n${n}\n\`\`\``
		}] };
	});
}
//#endregion
//#region src/lib/server.ts
var Y = {
	crypto: !0,
	response: !0,
	log: !0,
	winston: !0,
	schema: !0,
	errors: !0,
	client: !0
};
function X(e = Y) {
	let t = new r({
		name: "qnx-mcp-server",
		version: "0.8.2"
	});
	return e.response && e.errors && H(t), e.crypto && (I(t), B(t)), e.response && (G(t), J(t)), e.winston && (b(t), x(t)), e.log && (w(t), D(t)), e.errors && (f(t), _(t)), e.client && (A(t), N(t)), t;
}
//#endregion
//#region src/lib/transport.ts
function Z(e) {
	let r = /* @__PURE__ */ new Map();
	return async function(i, a) {
		let o = i.headers["mcp-session-id"];
		if (o && r.has(o)) {
			await r.get(o).handleRequest(i, a, i.body);
			return;
		}
		if (!o && i.method === "POST" && n(i.body)) {
			let n = new t({
				sessionIdGenerator: () => crypto.randomUUID(),
				onsessioninitialized: (e) => {
					r.set(e, n);
				}
			});
			n.onclose = () => {
				n.sessionId && r.delete(n.sessionId);
			}, await X(e).connect(n), await n.handleRequest(i, a, i.body);
			return;
		}
		a.status(400).json({ error: "Invalid MCP request" });
	};
}
//#endregion
//#region src/main.ts
var Q = e();
Q.use(e.json()), Q.all("/mcp", Z()), Q.all("/mcp/crypto", Z({ crypto: !0 })), Q.all("/mcp/response", Z({ response: !0 })), Q.all("/mcp/errors", Z({ errors: !0 })), Q.all("/mcp/client", Z({ client: !0 })), Q.all("/mcp/winston", Z({ winston: !0 })), Q.all("/mcp/log", Z({ log: !0 }));
var $ = process.env.PORT || 4e3;
Q.listen($, () => {
	console.log(`MCP server running at http://localhost:${$}`), console.log("  /mcp          → all tools"), console.log("  /mcp/crypto   → crypto tools"), console.log("  /mcp/response → response tools"), console.log("  /mcp/errors   → errors tools"), console.log("  /mcp/client   → client tools"), console.log("  /mcp/winston  → file logger tools"), console.log("  /mcp/log      → console logger tools");
}).on("error", (e) => {
	e.code === "EADDRINUSE" ? console.error(`Port ${$} is already in use`) : console.error(e), process.exit(1);
});
//#endregion
