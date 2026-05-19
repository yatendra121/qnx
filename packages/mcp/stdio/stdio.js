#!/usr/bin/env node
import { StdioServerTransport as e } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer as t } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as n } from "zod";
import { InvalidValueError as r, ServerError as i, UnauthenticatedUserError as a, ValidationError as o, errorCodes as s } from "@qnx/errors";
//#region src/lib/tools/example.tool.ts
function c(e) {
	e.registerTool("example", {
		description: "An example tool that echoes back a message",
		inputSchema: { message: n.string().describe("Message to echo") }
	}, async ({ message: e }) => ({ content: [{
		type: "text",
		text: `Echo: ${e}`
	}] }));
}
//#endregion
//#region src/lib/tools/format-error.tool.ts
var l = [
	"ValidationError",
	"InvalidValueError",
	"UnauthenticatedUserError",
	"ServerError"
], u = {
	ValidationError: "Requires: message, fields (≥1 entry with field + message)",
	InvalidValueError: "Requires: message, fields (exactly 1 entry with field + message)",
	UnauthenticatedUserError: "Requires: message only — fields is ignored",
	ServerError: "Requires: message only — fields is ignored"
};
function d(e) {
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
			errorClass: n.enum(l).describe("ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError"),
			message: n.string().describe("The error message (required for all classes)"),
			fields: n.array(n.object({
				field: n.string().describe("Field name (e.g. \"email\")"),
				message: n.string().describe("Error message for this field")
			})).optional().describe("ValidationError: required, ≥1 entry. InvalidValueError: required, first entry used. Others: not applicable.")
		}
	}, async ({ errorClass: e, message: t, fields: n }) => {
		if (e === "ValidationError") {
			if (!n || n.length === 0) return { content: [{
				type: "text",
				text: `Error: ValidationError requires at least one entry in "fields". ${u.ValidationError}`
			}] };
			let r = {};
			for (let e of n) r[e.field] = [e.message];
			let i = new o(t, { errRes: { errors: r } });
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
				text: `Error: InvalidValueError requires exactly one entry in "fields". ${u.InvalidValueError}`
			}] };
			let { field: t, message: i } = n[0], a = new r(i, { key: t });
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
			let n = new a(t);
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
		let s = new i(t);
		return { content: [{
			type: "text",
			text: JSON.stringify({
				errorClass: e,
				message: s.message,
				code: s.getCode(),
				errorResponse: null
			}, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/create-error-instance.tool.ts
var f = [
	"ApiError",
	"ValidationError",
	"InvalidValueError",
	"UnauthenticatedUserError",
	"ServerError",
	"all"
], p = {
	ApiError: "## `ApiError`\n\n> Base error class. All other error classes extend this.\n\n**Purpose:** Generic customizable error with a manual HTTP status code and optional field-level error response.\n\n**Constructor**\n```ts\nnew ApiError(message: string, code: number, option?: { errRes?: ErrorResponse })\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | The HTTP status code passed to the constructor |\n| `getErrorResponse()` | `ErrorResponse | undefined` | The error response object, if provided |\n\n**Example**\n```ts\nconst error = new ApiError('Something went wrong', 500, {\n  errRes: {\n    errors: {\n      generic: ['Unexpected error occurred']\n    }\n  }\n})\n\nerror.message          // \"Something went wrong\"\nerror.getCode()        // 500\nerror.getErrorResponse() // { errors: { generic: ['Unexpected error occurred'] } }\n```\n\n> **Note:** `ApiError` is an internal base class and is not exported from `@qnx/errors`. Use the specialized subclasses instead.",
	ValidationError: "## `ValidationError`\n\n> For multi-field form or schema validation failures.\n\n**Extends:** `ApiError`\n\n**Default code:** `errorCodes.VALIDATION_ERROR_CODE` (default: `422`)\n\n**Constructor**\n```ts\nnew ValidationError(message: string, option: { errRes: ErrorResponse })\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `VALIDATION_ERROR_CODE` (default 422) |\n| `getErrorResponse()` | `ErrorResponse` | The full field-level error map |\n\n**Example**\n```ts\nimport { ValidationError } from '@qnx/errors'\n\nthrow new ValidationError('Validation failed', {\n  errRes: {\n    errors: {\n      email: ['Email is invalid'],\n      password: ['Password must be at least 8 characters']\n    }\n  }\n})\n```\n\n**Use when:** Multiple fields fail validation at once (e.g. form submission, request body parsing).",
	InvalidValueError: "## `InvalidValueError`\n\n> For a single-field validation failure.\n\n**Extends:** `ValidationError` → `ApiError`\n\n**Default code:** `errorCodes.VALIDATION_ERROR_CODE` (default: `422`)\n\n**Constructor**\n```ts\nnew InvalidValueError(message: string, { key }: { key: string })\n```\n\nThe `key` becomes the field name in `errorResponse.errors`, with the message as its value.\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `VALIDATION_ERROR_CODE` (default 422) |\n| `getErrorResponse()` | `ErrorResponse` | `{ errors: { [key]: [message] } }` |\n\n**Example**\n```ts\nimport { InvalidValueError } from '@qnx/errors'\n\nthrow new InvalidValueError('Username cannot contain spaces', { key: 'username' })\n\n// getErrorResponse() → { errors: { username: ['Username cannot contain spaces'] } }\n```\n\n**Use when:** Exactly one field is invalid (e.g. checking a single query param or path value).",
	UnauthenticatedUserError: "## `UnauthenticatedUserError`\n\n> For missing or invalid authentication.\n\n**Extends:** `ApiError`\n\n**Default code:** `errorCodes.UNAUTHENTICATED_USER_ERROR_CODE` (default: `401`)\n\n**Constructor**\n```ts\nnew UnauthenticatedUserError(message: string)\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `UNAUTHENTICATED_USER_ERROR_CODE` (default 401) |\n| `getErrorResponse()` | `undefined` | Always undefined — no field-level errors |\n\n**Example**\n```ts\nimport { UnauthenticatedUserError } from '@qnx/errors'\n\nthrow new UnauthenticatedUserError('User not authenticated')\n\n// getCode()          → 401\n// getErrorResponse() → undefined\n```\n\n**Use when:** The request lacks a valid session or bearer token.",
	ServerError: "## `ServerError`\n\n> For unexpected internal failures the user cannot fix.\n\n**Extends:** `ApiError`\n\n**Default code:** `errorCodes.SERVER_ERROR_CODE` (default: `500`)\n\n**Constructor**\n```ts\nnew ServerError(message: string)\n```\n\n**Methods**\n| Method | Returns | Description |\n| --- | --- | --- |\n| `getCode()` | `number` | `SERVER_ERROR_CODE` (default 500) |\n| `getErrorResponse()` | `undefined` | Always undefined — no field-level errors |\n\n**Example**\n```ts\nimport { ServerError } from '@qnx/errors'\n\nthrow new ServerError('Internal server error')\n\n// getCode()          → 500\n// getErrorResponse() → undefined\n```\n\n**Use when:** A database call fails, an external service is unreachable, or any unrecoverable runtime error occurs."
}, m = "## Summary\n\n| Error Class | Purpose | Default Code | Use When |\n| --- | --- | --- | --- |\n| `ApiError` | Generic base error | Custom | Internal base — use subclasses instead |\n| `ValidationError` | Multi-field validation | 422 | Input or schema validation fails |\n| `InvalidValueError` | Single-field validation | 422 | One field like `email` or `username` is bad |\n| `UnauthenticatedUserError` | Auth failure | 401 | User not logged in or token missing |\n| `ServerError` | Internal system failure | 500 | Something broke that the user cannot fix |", h = "## Customizing Error Codes\n\nOverride the default HTTP codes globally using `setErrorCodes`:\n\n```ts\nimport { setErrorCodes } from '@qnx/errors'\n\nsetErrorCodes({\n  VALIDATION_ERROR_CODE: 400,\n  UNAUTHENTICATED_USER_ERROR_CODE: 401,\n  SERVER_ERROR_CODE: 500\n})\n```\n\nAll three keys are optional — only the ones you provide will be updated.";
function g(e) {
	e.registerTool("get-error-class-docs", {
		description: "Get documentation for a @qnx/errors error class — constructor signature, methods, usage example, and when to use it. Pass \"all\" to get the full reference including the summary table and custom codes guide.",
		inputSchema: { errorClass: n.enum(f).describe("ApiError | ValidationError | InvalidValueError | UnauthenticatedUserError | ServerError | all") }
	}, async ({ errorClass: e }) => {
		let t;
		return t = e === "all" ? [
			"# `@qnx/errors` Reference\n",
			p.ApiError,
			p.ValidationError,
			p.InvalidValueError,
			p.UnauthenticatedUserError,
			p.ServerError,
			m,
			h
		].join("\n\n---\n\n") : p[e], { content: [{
			type: "text",
			text: t
		}] };
	});
}
//#endregion
//#region src/lib/tools/build-api-response.tool.ts
var _ = [
	"success",
	"validation-error",
	"invalid-value",
	"unauthenticated",
	"server-error"
], v = {
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
function y(e) {
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
			type: n.enum(_).describe("success | validation-error | invalid-value | unauthenticated | server-error"),
			data: n.record(n.string(), n.unknown()).optional().describe("success only — response payload, wrapped as { data: ... }"),
			message: n.string().optional().describe("success only — human-readable success message"),
			errors: n.record(n.string(), n.array(n.string())).optional().describe("validation-error only (required) — field errors map: { fieldName: [\"error msg\"] }"),
			field: n.string().optional().describe("invalid-value only (required) — the name of the invalid field"),
			error: n.string().optional().describe("invalid-value | server-error only — the error message")
		}
	}, async ({ type: e, data: t, message: n, errors: r, field: i, error: a }) => {
		let o, c;
		if (e === "success") o = 200, c = {}, t !== void 0 && (c.data = t), n !== void 0 && (c.message = n);
		else if (e === "validation-error") {
			o = s.VALIDATION_ERROR_CODE;
			let e = r ? Object.values(r)[0]?.[0] ?? "" : "";
			c = {
				errors: r ?? {},
				error: e
			};
		} else if (e === "invalid-value") {
			o = s.VALIDATION_ERROR_CODE;
			let e = i ?? "field", t = a ?? "Invalid value";
			c = {
				errors: { [e]: [t] },
				error: t
			};
		} else e === "unauthenticated" ? (o = s.UNAUTHENTICATED_USER_ERROR_CODE, c = {
			errorCode: "unauthenticated",
			message: "Unauthenticated"
		}) : (o = s.SERVER_ERROR_CODE, c = { serverError: {
			name: "Error",
			message: a ?? "Internal server error",
			stack: "..."
		} });
		let l = {
			statusCode: o,
			body: c,
			producedBy: v[e]
		};
		return { content: [{
			type: "text",
			text: JSON.stringify(l, null, 2)
		}] };
	});
}
//#endregion
//#region src/lib/tools/response-pattern.tool.ts
var b = [
	"async-handler",
	"success",
	"validation-error",
	"invalid-value",
	"throw-validation",
	"zod-validation",
	"unauthenticated",
	"resource-route"
], x = {
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
function S(e) {
	e.registerTool("get-response-docs", {
		description: "Get a TypeScript code example for a @qnx/response usage pattern. Covers handler setup, success responses, validation errors, Zod validation, unauthenticated responses, and resource routes.",
		inputSchema: { pattern: n.enum(b).describe("async-handler | success | validation-error | invalid-value | throw-validation | zod-validation | unauthenticated | resource-route") }
	}, async ({ pattern: e }) => {
		let { description: t, code: n } = x[e];
		return { content: [{
			type: "text",
			text: `## ${e}\n\n${t}\n\n\`\`\`typescript\n${n}\n\`\`\``
		}] };
	});
}
//#endregion
//#region src/lib/server.ts
var C = {
	crypto: !0,
	response: !0,
	log: !0,
	schema: !0,
	errors: !0
};
function w(e = C) {
	let n = new t({
		name: "qnx-mcp-server",
		version: "0.8.2"
	});
	return c(n), e.response && (y(n), S(n)), e.errors && (d(n), g(n)), n;
}
//#endregion
//#region src/stdio.ts
var T = process.argv[2], E = w(T ? { [T]: !0 } : void 0), D = new e();
E.connect(D).catch(console.error);
//#endregion
