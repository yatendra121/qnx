import type { McpServerConfig } from '../server'

export interface KnownError {
    id: string
    package: keyof McpServerConfig | 'mcp'
    title: string
    /** An error matches if any of these do. */
    patterns: RegExp[]
    cause: string
    fix: string
    code?: string
    docs?: string
}

const PEER_INSTALLS: Record<string, string> = {
    jose: 'npm install @qnx/crypto jose uuid',
    uuid: 'npm install @qnx/crypto jose uuid',
    chalk: 'npm install @qnx/log chalk',
    winston: 'npm install @qnx/winston winston winston-daily-rotate-file',
    'winston-daily-rotate-file': 'npm install @qnx/winston winston winston-daily-rotate-file',
    zod: 'npm install @qnx/response @qnx/errors express zod@4',
    express: 'npm install @qnx/response @qnx/errors express zod@4',
    '@qnx/errors': 'npm install @qnx/response @qnx/errors express zod@4'
}

const PEER_NAMES = Object.keys(PEER_INSTALLS).sort((a, b) => b.length - a.length).join('|')

const PEER_PATTERN = new RegExp(`(?:Cannot find (?:package|module) ['"]|Failed to resolve (?:import|module specifier) ['"]|Can't resolve ['"])(${PEER_NAMES})['"/]`, 'i')

/** The install command for the peer dependency named in an error, if one is. */
export function peerInstallCommand(error: string) {
    const name = PEER_PATTERN.exec(error)?.[1]
    return name ? PEER_INSTALLS[name] : undefined
}

/**
 * Errors the @qnx/* packages and their dependencies really produce. tools.contract.spec.ts reproduces
 * these with the real libraries, so a changed message or a wrong explanation fails the build.
 */
export const knownErrors: KnownError[] = [
    {
        id: 'missing-key-env',
        package: 'crypto',
        title: 'Auth token key is missing from the environment',
        patterns: [/(JWT|JWE) (public|private) key is not found in environment variables/i],
        cause: 'generateAuthToken needs JWT_PRIVATE_KEY and JWE_PUBLIC_KEY. decryptAuthToken needs JWT_PUBLIC_KEY and JWE_PRIVATE_KEY. They are read on first use, so the variable is unset or your .env file loads too late.',
        fix: 'Generate the keys if you have none, set all four variables, and load .env before the first token call.',
        code: `// Load .env first, or run with: node --env-file=.env app.js
import 'dotenv/config'
import { generateAuthToken } from '@qnx/crypto'`,
        docs: 'get-crypto-docs { "topic": "setup" }'
    },
    {
        id: 'pem-literal-newlines',
        package: 'crypto',
        title: 'PEM key has literal \\n instead of line breaks',
        // "Invalid character in header content" comes from Node's HTTP code, not a key.
        // Node 26 decodes base64 natively, so its message differs.
        patterns: [/Invalid character(?! in )/i, /InvalidCharacterError/, /cannot be part of a valid base64 string/i],
        cause: 'The PEM body is base64 decoded, and a literal backslash-n is not valid base64. Hosting dashboards and Docker usually keep \\n as typed, and so do .env values without double quotes.',
        fix: 'In a .env file, put the value in double quotes. On other hosts, convert the value once at startup, before the first token call.',
        code: `for (const name of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'JWE_PRIVATE_KEY', 'JWE_PUBLIC_KEY']) {
  process.env[name] = process.env[name]?.replace(/\\\\n/g, '\\n')
}`,
        docs: 'get-crypto-docs { "topic": "setup" }'
    },
    {
        id: 'pem-wrong-format',
        package: 'crypto',
        title: 'Key is not in the format the helper expects',
        patterns: [/"pkcs8" must be PKCS#?8/i, /"spki" must be SPKI/i],
        cause: 'toPKCS8Secret needs a private key starting BEGIN PRIVATE KEY, and toSPKISecret needs a public key starting BEGIN PUBLIC KEY. The usual causes are swapped public and private keys, or a BEGIN EC PRIVATE KEY or BEGIN RSA PRIVATE KEY file, which is an older format. The value may also be empty, or have quotes around it.',
        fix: 'Check which key is in which variable. Convert an older private key to PKCS#8 with OpenSSL.',
        code: 'openssl pkcs8 -topk8 -nocrypt -in old-key.pem -out private-key.pem',
        docs: 'get-crypto-docs { "topic": "setup" }'
    },
    {
        id: 'pem-corrupt',
        package: 'crypto',
        title: 'PEM key body is cut short or corrupt',
        patterns: [/Invalid keyData/i],
        cause: 'The value has the right BEGIN and END lines, but the content between them is not a complete key. It was probably cut off or changed when it was copied.',
        fix: 'Copy the whole key again, or generate a new pair.',
        docs: 'get-crypto-docs { "topic": "setup" }'
    },
    {
        id: 'aes-key-length',
        package: 'crypto',
        title: 'Symmetric JWE secret is the wrong length',
        patterns: [/Invalid key length/i],
        cause: 'AES key wrap needs a secret of an exact length: 16 bytes for A128KW, 24 for A192KW and 32 for A256KW.',
        fix: 'Use a secret of exactly that length.',
        code: 'openssl rand -hex 16 # prints 32 characters, which is 32 bytes for A256KW',
        docs: 'get-crypto-docs { "topic": "key-helpers" }'
    },
    {
        id: 'curve-mismatch',
        package: 'crypto',
        title: 'Key curve does not match the algorithm',
        patterns: [/Named curve mismatch/i],
        cause: 'ES256 and the auth token helpers need a P-256 key. This key uses another curve, such as P-384.',
        fix: 'Generate a P-256 key, or use the algorithm that matches the key: ES384 for P-384 or ES512 for P-521.',
        code: 'openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out private-key.pem',
        docs: 'get-crypto-docs { "topic": "setup" }'
    },
    {
        id: 'symmetric-secret-without-alg',
        package: 'crypto',
        title: 'Symmetric secret used with an asymmetric algorithm',
        patterns: [/Key for the \S+ algorithm must be/i],
        cause: 'jwtSign defaults to ES256, which needs an asymmetric key, so a toSymmetricSecret value fails unless you also pass alg. The same message appears for any key that does not suit the algorithm.',
        fix: 'Pass the HMAC algorithm to jwtSign.',
        code: `const token = await jwtSign(payload, toSymmetricSecret(secret), { alg: 'HS256', expirationTime: '2h' })`,
        docs: 'get-crypto-docs { "topic": "jwt" }'
    },
    {
        id: 'imported-key-without-alg',
        package: 'crypto',
        title: 'jwtSign used a different algorithm from the key',
        patterns: [/CryptoKey does not support this operation/i],
        cause: 'jwtSign defaults to ES256, whatever algorithm the key was imported for. A key imported for RS256 can\'t sign with ES256.',
        fix: 'Pass the same alg to jwtSign as to toPKCS8Secret.',
        code: `const key = await toPKCS8Secret(pem, 'RS256')
const token = await jwtSign(payload, key, { alg: 'RS256' })`,
        docs: 'get-crypto-docs { "topic": "jwt" }'
    },
    {
        id: 'alg-not-supported',
        package: 'crypto',
        title: 'Algorithm is not supported for this key',
        patterns: [/JOSENotSupported/, /ERR_JOSE_NOT_SUPPORTED/, /Invalid or unsupported "alg"/i, /alg none is not supported/i, /Key for the none algorithm/i],
        cause: 'jose can\'t use this algorithm here. It may suit a different kind of key, such as HS256 with toPKCS8Secret or A256KW with toSPKISecret, or it may not be supported at all, such as none.',
        fix: 'Use toSymmetricSecret for HS256, HS384, HS512, A128KW and A256KW. Use toPKCS8Secret and toSPKISecret for ES256, RS256, ECDH-ES and RSA-OAEP.',
        docs: 'get-crypto-docs { "topic": "algorithms" }'
    },
    {
        id: 'invalid-time-period',
        package: 'crypto',
        title: 'expirationTime is not a valid time period',
        patterns: [/Invalid time period format/i],
        cause: 'jose only accepts values like "30m", "2h" or "7d", a number of seconds since the epoch, or a Date.',
        fix: 'Pass a value in one of those forms.',
        code: `await jwtSign(payload, key, { expirationTime: '2h' })`,
        docs: 'get-crypto-docs { "topic": "jwt" }'
    },
    {
        id: 'jwt-expired',
        package: 'crypto',
        title: 'JWT has expired',
        patterns: [/JWTExpired/, /ERR_JWT_EXPIRED/, /"exp" claim timestamp check failed/i],
        cause: 'The token is past its exp time. This is jwtVerify working as intended. Auth tokens from generateAuthToken have no exp, so this comes from a token you signed with expirationTime.',
        fix: 'Catch it and respond 401, so that the client logs in or refreshes. If it happens too early, check the server clocks.',
        code: `import { errors } from 'jose'

try {
  await jwtVerify(token, key)
} catch (error) {
  if (error instanceof errors.JWTExpired) throw new UnauthenticatedUserError('Token expired')
  throw error
}`,
        docs: 'get-crypto-docs { "topic": "jwt" }'
    },
    {
        id: 'jwt-claim-failed',
        package: 'crypto',
        title: 'JWT claim check failed',
        patterns: [/JWTClaimValidationFailed/, /ERR_JWT_CLAIM_VALIDATION_FAILED/, /claim validation failed/i],
        cause: 'A claim failed a check you passed to jwtVerify, such as issuer or audience, or nbf is in the future.',
        fix: 'Compare the token\'s claims with the options passed to jwtVerify.',
        docs: 'get-crypto-docs { "topic": "jwt" }'
    },
    {
        id: 'jws-signature-failed',
        package: 'crypto',
        title: 'JWT signature does not match',
        patterns: [/JWSSignatureVerificationFailed/, /ERR_JWS_SIGNATURE_VERIFICATION_FAILED/, /signature verification failed/i],
        cause: 'The token was changed after signing, or was signed with a different key from the one verifying it. That commonly follows a key rotation, or a mix-up between environments.',
        fix: 'Treat it as an invalid token and respond 401. If valid tokens fail, check that the public key matches the private key that signed them.',
        docs: 'get-crypto-docs { "topic": "jwt" }'
    },
    {
        id: 'jwe-decryption-failed',
        package: 'crypto',
        title: 'JWE could not be decrypted',
        patterns: [/JWEDecryptionFailed/, /ERR_JWE_DECRYPTION_FAILED/, /decryption operation failed/i],
        cause: 'The token was changed, or was encrypted for a different key. That commonly follows a key rotation, a mix-up between environments, or a token cut short in transit.',
        fix: 'Treat it as an invalid token and respond 401. If valid tokens fail, check that JWE_PRIVATE_KEY matches the JWE_PUBLIC_KEY that encrypted them.',
        docs: 'get-crypto-docs { "topic": "auth-token" }'
    },
    {
        id: 'malformed-token',
        package: 'crypto',
        title: 'Token is malformed',
        patterns: [/JWSInvalid/, /JWEInvalid/, /JWTInvalid/, /ERR_JW[SET]_INVALID/, /Invalid Compact JW[SE]/i, /JWTs must use Compact JWS/i],
        cause: 'The value isn\'t a complete token. It may be empty or undefined, cut short, or still have a "Bearer " prefix. A JWT passed to a JWE function, or the reverse, also fails like this.',
        fix: 'Log the token\'s length and first few characters (not the whole token) where it\'s read, and strip any "Bearer " prefix. Treat it as an invalid token and respond 401.',
        docs: 'get-crypto-docs { "topic": "auth-token" }'
    },
    {
        id: 'peer-dependency-missing',
        package: 'crypto',
        title: 'A peer dependency is not installed',
        patterns: [PEER_PATTERN],
        cause: 'The @qnx/* packages keep libraries like jose, uuid, chalk, winston and zod as peer dependencies. npm installs them by default, but not with --legacy-peer-deps or some other package manager settings.',
        fix: 'Install it directly.'
    },
    {
        id: 'zod-peer-conflict',
        package: 'response',
        title: '@qnx/response needs zod 4',
        patterns: [/ERESOLVE[\s\S]*zod/i, /zod[\s\S]*ERESOLVE/i, /unmet peer zod/i],
        cause: '@qnx/response has a peer dependency on zod 4.x, and your project has another major version.',
        fix: 'Upgrade to zod 4.',
        code: 'npm install zod@4',
        docs: 'get-response-docs { "pattern": "install" }'
    },
    {
        id: 'qnx-errors-too-old',
        package: 'errors',
        title: '@qnx/errors is too old for @qnx/response',
        patterns: [/does not provide an export named '(ApiError|ValidationError|InvalidValueError|ApiResponseErrorsValue|setErrorCodes)'/i],
        cause: 'This version of @qnx/errors doesn\'t have that export. @qnx/response needs @qnx/errors 0.8.8 or later.',
        fix: 'Upgrade them together.',
        code: 'npm install @qnx/errors@latest @qnx/response@latest',
        docs: 'get-error-class-docs { "errorClass": "install" }'
    },
    {
        id: 'handler-returned-nothing',
        package: 'response',
        title: 'HTML 404 from a route that exists',
        patterns: [/Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//],
        cause: 'If the route is registered, its asyncValidatorHandler function probably returned nothing. Returning undefined calls next(), and with no later match Express sends this HTML 404. The work may well have been done. A resourceRoute method behaves the same way. The route may also simply not be registered at this path.',
        fix: 'Return something from every path through the function.',
        code: `router.delete('/items/:id', asyncValidatorHandler(async (req) => {
    await Item.delete(req.params.id)
    return initializeApiResponse().setMessage('Deleted.')
}))`,
        docs: 'get-response-docs { "pattern": "handler-return-values" }'
    },
    {
        id: 'request-body-empty',
        package: 'response',
        title: 'Validation fails because the request body is empty',
        patterns: [/expected object, received undefined/i, /Cannot (read|destructure) propert(y|ies)[^\n]*(req\.body|of undefined[^\n]*body)/i],
        cause: 'req.body is undefined. Either the client sent no Content-Type: application/json header, so express.json() skipped the body, or express.json() isn\'t installed before this route.',
        fix: 'Set the header on the client, and add app.use(express.json()) before your routes.',
        code: `await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})`,
        docs: 'get-client-docs { "topic": "handling-responses" }'
    },
    {
        id: 'invalid-status-code',
        package: 'errors',
        title: 'ApiError has an invalid status code',
        patterns: [/ERR_HTTP_INVALID_STATUS_CODE/, /Invalid status code/i],
        cause: 'A status outside 100-999 was passed, such as to ApiError or setStatusCode. Express throws while sending, so the request falls through to the app\'s error handler instead of responding with your error.',
        fix: 'Use a real HTTP status code.',
        code: `throw new ApiError('Conflict detected.', 409)`,
        docs: 'get-response-docs { "pattern": "custom-error" }'
    },
    {
        id: 'handler-not-a-function',
        package: 'response',
        title: 'asyncValidatorHandler was given something else',
        patterns: [/Provided parameter value is not a function/i],
        cause: 'asyncValidatorHandler received a value that isn\'t a function. A missing or misspelled import is the usual cause, because the value is undefined.',
        fix: 'Check the controller you pass in and how it\'s imported.',
        docs: 'get-response-docs { "pattern": "async-handler" }'
    },
    {
        id: 'headers-already-sent',
        package: 'response',
        title: 'Response sent twice',
        patterns: [/ERR_HTTP_HEADERS_SENT/, /Cannot set headers after they are sent/i],
        cause: 'Two pieces of code responded to one request. ApiResponse.response() is safe against this, so the second send is your own res.json() or res.send(). It may also run after next() has passed the request to another handler.',
        fix: 'Return from the handler once it has responded, and don\'t mix res.json() with returned values.',
        docs: 'get-response-docs { "pattern": "handler-return-values" }'
    },
    {
        id: 'server-error-in-response',
        package: 'response',
        title: 'Client receives serverError with a stack trace',
        patterns: [/"?serverError"?\s*:/, /serverError/],
        cause: 'An error other than a @qnx/errors class or ZodError was thrown inside asyncValidatorHandler. Those are sent with their name, message and stack, in every environment, and it can\'t be turned off.',
        fix: 'Throw ServerError or ApiError with a safe message for failures you expect, and wrap routes with safeHandler for the rest.',
        docs: 'get-response-docs { "pattern": "server-error" }'
    },
    {
        id: 'unauthenticated-message-ignored',
        package: 'errors',
        title: 'Custom UnauthenticatedUserError message is not sent',
        patterns: [/UnauthenticatedUserError[\s\S]*(message|ignored|always)/i, /"?errorCode"?\s*:\s*"?unauthenticated/i],
        cause: 'The response for this class is fixed: { errorCode: "unauthenticated", message: "Unauthenticated" }. The message you pass only appears in your own code and logs.',
        fix: 'To send a different message to clients, throw ApiError with status 401 instead.',
        code: `throw new ApiError('Session expired, please log in again.', 401)`,
        docs: 'get-error-class-docs { "errorClass": "http-responses" }'
    },
    {
        id: 'client-misses-failure',
        package: 'client',
        title: 'Failed request is treated as a success',
        patterns: [/getError\(\)[\s\S]*undefined/i, /getMessage\(\)[\s\S]*undefined/i, /getData\(\)[\s\S]*undefined/i],
        cause: 'getError() is only set on validation responses. On 401, 409 and 500 it\'s undefined, and on a message-only success getData() is undefined. These getters only read fields, and no field tells you whether the request succeeded.',
        fix: 'Check response.ok or the status.',
        code: `if (!response.ok) showError(res.getError() ?? res.getMessage())`,
        docs: 'get-client-docs { "topic": "handling-responses" }'
    },
    {
        id: 'error-logged-as-empty-object',
        package: 'winston',
        title: 'Log entry has an empty error',
        patterns: [/"error"\s*:\s*\{\s*\}/, /error\s*:\s*\{\s*\}/],
        cause: 'An Error nested in metadata, such as logger.error(\'msg\', { error: err }), is written as {}: an Error\'s message and stack don\'t serialise to JSON.',
        fix: 'Pass the Error as the second argument. To add metadata as well, copy its message and stack into the metadata.',
        code: `logger.error('Payment failed', err)`,
        docs: 'get-file-logger-docs { "topic": "logging-errors" }'
    },
    {
        id: 'logs-directory-failure',
        package: 'winston',
        title: 'Logger can\'t create its logs directory',
        patterns: [/(EEXIST|EROFS|EACCES|EPERM|ENOTDIR)[^\n]*\b(mkdir|logs)\b/i],
        cause: 'Importing @qnx/winston creates ./logs under the current working directory, and the import throws if it can\'t. That happens on read-only filesystems such as serverless hosts, or if a file named logs is already there.',
        fix: 'Run from a writable directory and remove any file named logs. On hosts without a writable disk, use a different logger: this one only writes to files, and its path can\'t be configured.',
        docs: 'get-file-logger-docs { "topic": "configuration" }'
    },
    {
        id: 'ts-env-string-undefined',
        package: 'crypto',
        title: 'TypeScript rejects process.env values',
        patterns: [/TS2345[\s\S]*string \| undefined/, /Argument of type 'string \| undefined' is not assignable/],
        cause: 'process.env values have the type string | undefined, and the key helpers need a string.',
        fix: 'Check the value first. That also gives a clear error if it\'s missing at runtime.',
        code: `const pem = process.env.JWT_PRIVATE_KEY
if (!pem) throw new Error('JWT_PRIVATE_KEY is not set')
const key = await toPKCS8Secret(pem, 'ES256')`,
        docs: 'build-crypto-snippet'
    },
    {
        id: 'ts-jwe-options',
        package: 'crypto',
        title: 'TypeScript requires both alg and enc',
        patterns: [/Property '(alg|enc)' is missing in type/],
        cause: 'Each jweEncrypt option has a default at runtime, but its type requires both as soon as you pass options.',
        fix: 'Pass both.',
        code: `await jweEncrypt(text, key, { alg: 'ECDH-ES+A128KW', enc: 'A128GCM' })`,
        docs: 'get-crypto-docs { "topic": "jwe" }'
    },
    {
        id: 'interfaces-request-type',
        package: 'response',
        title: 'The Request type from @qnx/interfaces is not an Express request',
        patterns: [/Type 'AuthRequest' does not satisfy the constraint/, /does not exist on type 'AuthRequest'/, /Argument of type '\(req: AuthRequest/],
        cause: 'Up to at least 0.8.15, a build problem makes the published Request type extend the global Fetch Request rather than Express\'s. It has user, url and method, but not params or query, and it isn\'t accepted where an Express request is needed.',
        fix: 'Define the type yourself from Express\'s Request and the package\'s User.',
        code: `import type { User } from '@qnx/interfaces'
import type { Request } from 'express'

type AuthRequest = Request & { user: User }`,
        docs: 'get-package-info { "package": "@qnx/interfaces" }'
    },
    {
        id: 'mcp-session-not-found',
        package: 'mcp',
        title: 'MCP server answered "Session not found"',
        patterns: [/Session not found/i],
        cause: 'Versions of the QNX MCP server up to 0.8.15 kept sessions in memory. On hosted deployments with several instances, a request reaching another instance got this 404, most often during parallel calls. Later versions don\'t use sessions.',
        fix: 'Update the server, or run it locally with stdio: npx -y @qnx/mcp'
    }
]
