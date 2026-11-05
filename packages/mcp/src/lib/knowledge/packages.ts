import type { McpServerConfig } from '../server'

export type ExportKind = 'function' | 'class' | 'const' | 'type'

export interface PackageExport {
    name: string
    kind: ExportKind
    signature: string
}

export interface PackageInfo {
    name: string
    summary: string
    runsIn: string
    install: string
    /** Mirrors package.json. tools.contract.spec.ts fails if this drifts. */
    peerDependencies: string[]
    /** The package's tools, if it has its own scope. */
    scope?: keyof McpServerConfig
    docsTool?: string
    exports: PackageExport[]
    example?: string
    notes?: string[]
}

const type = (name: string, signature = name): PackageExport => ({ name, kind: 'type', signature })
const fn = (name: string, signature: string): PackageExport => ({ name, kind: 'function', signature })
const cls = (name: string, signature = name): PackageExport => ({ name, kind: 'class', signature })
const constant = (name: string, signature: string): PackageExport => ({ name, kind: 'const', signature })

/** Every published @qnx/* library. tools.contract.spec.ts checks the exports against the real packages. */
export const packages: PackageInfo[] = [
    {
        name: '@qnx/response',
        summary: 'Express route wrapper and response builder: return values to respond, throw to send an error',
        runsIn: 'Node.js with Express 4 or 5',
        install: 'npm install @qnx/response @qnx/errors express zod@4',
        peerDependencies: ['@qnx/errors', 'express', 'zod'],
        scope: 'response',
        docsTool: 'get-response-docs { "pattern": "all" }',
        exports: [
            fn('asyncValidatorHandler', 'asyncValidatorHandler<T extends Request>(func: ExecuteFun<T>): RequestHandler'),
            fn('resourceRoute', 'resourceRoute<T extends Request>(router: Router, controller: ResourceController<T>): void'),
            cls('ApiResponse', 'class ApiResponse<T = unknown>'),
            fn('initializeApiResponse', 'initializeApiResponse(): ApiResponse'),
            fn('setCallback', 'setCallback({ logger }: Partial<CallbackObj>): void'),
            fn('errorApiResponse', 'errorApiResponse(response: Response, error: Error): Response'),
            fn('invalidApiResponse', 'invalidApiResponse(response: Response, errors: ApiResponseErrors | undefined, statusCode?: number): Response'),
            fn('unauthenticateApiResponse', 'unauthenticateApiResponse(response: Response): Response'),
            fn('serverErrorApiResponse', 'serverErrorApiResponse(response: Response, error: unknown): Response'),
            fn('invalidValueApiResponse', 'Deprecated. invalidValueApiResponse(response: Response, errorKey: string, errorMessage: string): Response'),
            fn('throwInvalidValueApiResponse', 'Deprecated. throwInvalidValueApiResponse(errorKey: string, errorMessage: string): never'),
            fn('errorFormatter', 'errorFormatter({ msg }: { msg: string }): string[]'),
            cls('ApiResponseErrorsValue', 'Deprecated copy. Import it from @qnx/errors'),
            constant('callbackObj', 'callbackObj: CallbackObj. Internal: the current setCallback value'),
            type('ExecuteFun', 'ExecuteFun<T> = (req: T, res: Response, next: NextFunction) => Promise<unknown>'),
            type('ResourceController', 'ResourceController<T>: optional changeStatus, create, findAll, findOne, update and remove functions'),
            type('functionNames', '"changeStatus" | "create" | "findAll" | "findOne" | "update" | "remove"'),
            type('CallbackObj', 'CallbackObj = { logger?: { serverError: (error: Error) => void } }'),
            type('ApiResponseErrors', 'ApiResponseErrors = Record<string, string[]>'),
            type('ErrorResponse', 'ErrorResponse = { errors?: ApiResponseErrors }')
        ]
    },
    {
        name: '@qnx/errors',
        summary: 'Error classes that @qnx/response turns into HTTP responses',
        runsIn: 'Node.js and browsers',
        install: 'npm install @qnx/errors',
        peerDependencies: [],
        scope: 'errors',
        docsTool: 'get-error-class-docs { "errorClass": "all" }',
        exports: [
            cls('ApiError', 'new ApiError(message: string, code: number, option?: { errRes?: ErrorResponse })'),
            cls('ValidationError', 'new ValidationError(message: string, option: { errRes: ErrorResponse })'),
            cls('InvalidValueError', 'new InvalidValueError(message: string, { key }: { key: string })'),
            cls('UnauthenticatedUserError', 'new UnauthenticatedUserError(message: string)'),
            cls('ServerError', 'new ServerError(message: string)'),
            cls('ApiResponseErrorsValue', 'ApiResponseErrorsValue.getInstance() with addError, setError, hasErrors, getErrors, getErrorResponse'),
            constant('errorCodes', 'errorCodes: ErrorCodes. The current status codes'),
            fn('setErrorCodes', 'setErrorCodes(codes: Partial<ErrorCodes>): void'),
            type('ErrorCodes', 'ErrorCodes = { VALIDATION_ERROR_CODE: number; UNAUTHENTICATED_USER_ERROR_CODE: number; SERVER_ERROR_CODE: number }'),
            type('ApiResponseErrors', 'ApiResponseErrors = Record<string, string[]>'),
            type('ErrorResponse', 'ErrorResponse = { errors?: ApiResponseErrors }')
        ]
    },
    {
        name: '@qnx/client',
        summary: 'Typed getters for reading @qnx/response bodies in a frontend or another service',
        runsIn: 'Browsers and Node.js',
        install: 'npm install @qnx/client',
        peerDependencies: [],
        scope: 'client',
        docsTool: 'get-client-docs { "topic": "all" }',
        exports: [
            cls('ApiResponse', 'new ApiResponse<T>(response?: ApiResponseValue<T>)'),
            cls('ApiSuccessResponse', 'new ApiSuccessResponse<T>(response: ApiSuccessResponseValue<T>)'),
            cls('ApiErrorResponse', 'new ApiErrorResponse(response: ApiErrorResponseValue)'),
            type('ApiResponseValue', 'ApiResponseValue<T>: optional data, errorCode, error, errors, message, serverError'),
            type('ApiSuccessResponseValue', 'ApiSuccessResponseValue<T> = { data: T; message: string }'),
            type('ApiErrorResponseValue', 'ApiErrorResponseValue = { error: string; errors: ApiErrors; errorCode?: string }'),
            type('ApiResponseInterface', 'The getters of ApiResponse'),
            type('ApiSuccessResponseInterface', 'The getters of ApiSuccessResponse'),
            type('ApiErrorResponseInterface', 'The getters of ApiErrorResponse'),
            type('ApiErrors', 'ApiErrors = Record<string, string[]>'),
            type('ApiErrorCode', 'ApiErrorCode = string'),
            type('ApiMessage', 'ApiMessage = string'),
            type('ApiError', 'ApiError = string. An alias for the message text, not the class from @qnx/errors')
        ],
        notes: ['The ApiResponse here reads a response. It is not the ApiResponse from @qnx/response, which builds one.']
    },
    {
        name: '@qnx/crypto',
        summary: 'JWT signing, JWE encryption and encrypted auth tokens, built on jose',
        runsIn: 'Node.js',
        install: 'npm install @qnx/crypto jose uuid',
        peerDependencies: ['jose', 'uuid'],
        scope: 'crypto',
        docsTool: 'get-crypto-docs { "topic": "all" }',
        exports: [
            fn('generateAuthToken', 'generateAuthToken(subject: string): Promise<{ token: string; dbToken: string }>'),
            fn('decryptAuthToken', 'decryptAuthToken(jwe: string): Promise<JWTPayload>'),
            fn('jwtSign', 'jwtSign(payload: JWTPayload, key, options?: { alg?, jti?, subject?, issuer?, expirationTime? }): Promise<string>'),
            fn('jwtVerify', 'jwtVerify(token: string, key, options?): Promise<{ payload, protectedHeader }>. Re-exported from jose'),
            fn('jweEncrypt', 'jweEncrypt(plaintext: string, key, options?: { alg: string; enc: string }): Promise<string>'),
            fn('jweDecrypt', 'jweDecrypt(jwe: string, key, options?): Promise<{ plaintext: string; protectedHeader }>'),
            fn('toSymmetricSecret', 'toSymmetricSecret(key: string): Uint8Array'),
            fn('toPKCS8Secret', 'toPKCS8Secret(pem: string, alg: string): Promise<CryptoKey>. jose importPKCS8'),
            fn('toSPKISecret', 'toSPKISecret(pem: string, alg: string): Promise<CryptoKey>. jose importSPKI'),
            fn('toJWKSecret', 'toJWKSecret(jwk: JWK, alg?: string): Promise<CryptoKey | Uint8Array>. jose importJWK')
        ],
        notes: ['Start with get-crypto-docs { "topic": "setup" } to generate keys. Auth tokens never expire on their own: see get-guide { "topic": "auth-session" }.']
    },
    {
        name: '@qnx/winston',
        summary: 'Zero-config logger that writes JSON to daily rotating files',
        runsIn: 'Node.js with a writable working directory',
        install: 'npm install @qnx/winston winston winston-daily-rotate-file',
        peerDependencies: ['winston', 'winston-daily-rotate-file'],
        scope: 'winston',
        docsTool: 'get-file-logger-docs { "topic": "all" }',
        exports: [
            constant('logger', 'logger: winston.Logger. Pre-configured, with no console output')
        ],
        notes: ['Log an Error with logger.error(\'message\', err). { error: err } writes {}: see get-file-logger-docs { "topic": "logging-errors" }.']
    },
    {
        name: '@qnx/log',
        summary: 'Colored console output with icons, for development and scripts',
        runsIn: 'Node.js',
        install: 'npm install @qnx/log chalk',
        peerDependencies: ['chalk'],
        scope: 'log',
        docsTool: 'get-console-log-docs { "topic": "all" }',
        exports: [
            fn('consoleLog', 'consoleLog(message: unknown, { type }?: { type?: Type }): void'),
            type('Type', '"info" | "success" | "warn" | "warning" | "error" | "debug" | "trace"')
        ]
    },
    {
        name: '@qnx/core-helpers',
        summary: 'Small utilities: process an array in chunks, read a value with a default, check for a function',
        runsIn: 'Node.js and browsers',
        install: 'npm install @qnx/core-helpers',
        peerDependencies: [],
        exports: [
            fn('asyncSubArrayGenerator', 'asyncSubArrayGenerator<T>(array: T[], size: number, delayMs = 0): AsyncGenerator<T[]>. Throws RangeError if size is 0 or less'),
            fn('collectTypeValue', 'collectTypeValue<T>(value: any, defaultValue: T): T. Returns value ?? defaultValue, converted with Number() if the default is a number'),
            fn('isFunction', 'isFunction(value: unknown): boolean')
        ],
        example: `import { asyncSubArrayGenerator, collectTypeValue, isFunction } from '@qnx/core-helpers'

// Process 2 items at a time, waiting 100 ms between chunks
for await (const chunk of asyncSubArrayGenerator([1, 2, 3, 4, 5], 2, 100)) {
    console.log(chunk) // [1, 2], then [3, 4], then [5]
}

collectTypeValue('42', 0)           // 42
collectTypeValue(undefined, 10)     // 10
collectTypeValue(null, 'fallback')  // 'fallback'

isFunction(() => undefined)         // true`,
        notes: ['collectTypeValue doesn\'t validate: collectTypeValue(\'abc\', 0) returns NaN. Only a number default converts the value, so collectTypeValue(42, \'text\') returns the number 42.']
    },
    {
        name: '@qnx/interfaces',
        summary: 'Shared TypeScript types for Express apps, including a Request with a typed user',
        runsIn: 'TypeScript only: it has no runtime code, so use import type',
        install: 'npm install @qnx/interfaces express',
        peerDependencies: ['express'],
        exports: [
            type('Request', 'A request with user: User. Read the first note below before using it'),
            type('Response', 'Express Response'),
            type('NextFunction', 'Express NextFunction'),
            type('User', 'User = { id: string; name: string; email: string; password: string }'),
            type('Message', 'Message = { message: string }')
        ],
        example: `import type { User } from '@qnx/interfaces'
import { asyncValidatorHandler } from '@qnx/response'
import { Router, type Request } from 'express'

// Use this rather than the package's own Request type: see the note below
type AuthRequest = Request & { user: User }

const router = Router()

// Pass the type to asyncValidatorHandler to get a typed req.user
router.get('/me', asyncValidatorHandler<AuthRequest>(async (req) => {
    return { id: req.user.id, name: req.user.name, query: req.query }
}))`,
        notes: [
            'Known issue up to at least 0.8.15: the published Request type extends the global Fetch Request, not Express\'s, because of a build problem. It has user, url and method, but not params or query, and asyncValidatorHandler<Request> fails with TS2344. Define your own type as the example does. User, Message, Response and NextFunction are fine.',
            'Nothing sets req.user for you: your auth middleware has to, and it\'s undefined at runtime if that middleware didn\'t run.',
            'User includes password, so don\'t return a whole User in a response.'
        ]
    },
    {
        name: '@qnx/message',
        summary: 'Standard text for user-facing messages',
        runsIn: 'Node.js and browsers',
        install: 'npm install @qnx/message',
        peerDependencies: [],
        exports: [
            fn('requiredField', 'requiredField(field: string): string. Returns "<field> is a required field."'),
            fn('message', 'message(): string. A placeholder that returns "message"')
        ],
        example: `import { requiredField } from '@qnx/message'
import { InvalidValueError } from '@qnx/errors'

throw new InvalidValueError(requiredField('Email'), { key: 'email' })
// → 400 { errors: { email: ['Email is a required field.'] }, error: 'Email is a required field.' }`
    }
]

export function renderPackage(info: PackageInfo) {
    const rows = info.exports.map(({ name, kind, signature }) =>
        `| \`${name}\` | ${kind} | ${signature.replace(/\|/g, '\\|')} |`
    )
    return [
        `# \`${info.name}\``,
        info.summary,
        `**Runs in:** ${info.runsIn}`,
        `**Install**\n\`\`\`bash\n${info.install}\n\`\`\``,
        info.peerDependencies.length > 0 ? `**Peer dependencies:** ${info.peerDependencies.join(', ')}` : '**Peer dependencies:** none',
        `**Public exports**\n\n| Name | Kind | Signature |\n| --- | --- | --- |\n${rows.join('\n')}`,
        ...(info.example ? [`**Example**\n\`\`\`ts\n${info.example}\n\`\`\``] : []),
        ...(info.notes ?? []).map((note) => `> ${note}`),
        info.docsTool ? `**Full documentation:** ${info.docsTool}` : `**Full documentation:** this page covers the whole package, and it has no other tools.`
    ].join('\n\n')
}

export function renderCatalogue() {
    return [
        '# `@qnx/*` Packages',
        'Node.js and TypeScript packages for building Express APIs and their clients. There are no UI components, composables or plugins, and this is unrelated to the QNX operating system.',
        '| Package | What it does | Runs in | Details |\n| --- | --- | --- | --- |\n' + packages.map(({ name, summary, runsIn }) =>
            `| \`${name}\` | ${summary} | ${runsIn} | get-package-info { "package": "${name}" } |`
        ).join('\n'),
        '**Which do I need?**\n\n- An Express API: `@qnx/response` and `@qnx/errors`\n- A frontend calling that API: `@qnx/client`\n- Login sessions or tokens: `@qnx/crypto`\n- Log files: `@qnx/winston`. Terminal output in development or scripts: `@qnx/log`\n- To build a feature end to end: get-guide'
    ].join('\n\n')
}
