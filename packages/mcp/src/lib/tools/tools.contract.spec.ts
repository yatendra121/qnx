import { generateKeyPairSync } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import * as jose from 'jose'
import ts from 'typescript'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as qnxClient from '@qnx/client'
import * as qnxCrypto from '@qnx/crypto'
import * as qnxErrors from '@qnx/errors'
import * as qnxLog from '@qnx/log'
import * as qnxResponse from '@qnx/response'
import { analyzeLegacyRoute } from '../knowledge/legacy-routes'
import { packages } from '../knowledge/packages'
import { callTool, compileStrict, fencedBlocks, runSnippet } from './__tests__/contract-helpers'
import { matchKnownErrors } from './diagnose-error.tool'

const { ApiError, InvalidValueError, ServerError, UnauthenticatedUserError, ValidationError, ApiResponseErrorsValue } = qnxErrors
const { asyncValidatorHandler } = qnxResponse
const { jwtSign, jwtVerify, jweEncrypt, jweDecrypt, generateAuthToken, decryptAuthToken, toPKCS8Secret, toSPKISecret, toSymmetricSecret } = qnxCrypto

const REPO_ROOT = resolve(__dirname, '../../../../..')
const ALL = { crypto: true, response: true, errors: true, client: true, winston: true, log: true }

const pem = { publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } } as const
const ecPair = (namedCurve = 'P-256') => generateKeyPairSync('ec', { namedCurve, ...pem })
const rsaPair = () => generateKeyPairSync('rsa', { modulusLength: 2048, ...pem })

/** Serves routes with Express and returns a request helper. */
async function serve(setup: (app: express.Express) => void) {
    const app = express()
    app.use(express.json())
    setup(app)
    const server = await new Promise<Server>((done) => {
        const started = app.listen(0, () => done(started as Server))
    })
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    return {
        base,
        close: () => new Promise((done) => server.close(done)),
        request: async (method: string, path: string, body?: unknown) => {
            const response = await fetch(base + path, {
                method,
                ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            })
            const text = await response.text()
            let json: unknown
            try { json = JSON.parse(text) } catch { json = undefined }
            return { status: response.status, json, text }
        }
    }
}

describe('build-api-response matches a real Express server (B5, B11)', () => {
    const throwing = (error: unknown) => asyncValidatorHandler(async () => { throw error })
    const cases: [string, Record<string, unknown>, express.RequestHandler][] = [
        ['success with data', { type: 'success', data: { id: 1 } }, asyncValidatorHandler(async () => qnxResponse.initializeApiResponse().setData({ id: 1 }))],
        ['success with an array', { type: 'success', data: [1, 2] }, asyncValidatorHandler(async () => [1, 2])],
        ['success, message only', { type: 'success', message: 'Deleted.' }, asyncValidatorHandler(async () => qnxResponse.initializeApiResponse().setMessage('Deleted.'))],
        ['success with 201', { type: 'success', data: { id: 1 }, statusCode: 201 }, asyncValidatorHandler(async () => qnxResponse.ApiResponse.getInstance().setStatusCode(201).setData({ id: 1 }))],
        ['validation-error', { type: 'validation-error', errors: { email: ['bad', 'worse'], name: ['short'] } }, throwing(new ValidationError('x', { errRes: { errors: { email: ['bad', 'worse'], name: ['short'] } } }))],
        ['validation-error, no fields', { type: 'validation-error', errors: {} }, throwing(new ValidationError('x', { errRes: { errors: {} } }))],
        ['invalid-value', { type: 'invalid-value', field: 'email', error: 'bad' }, throwing(new InvalidValueError('bad', { key: 'email' }))],
        ['custom-error', { type: 'custom-error', error: 'Conflict', statusCode: 409 }, throwing(new ApiError('Conflict', 409))],
        ['custom-error with fields', { type: 'custom-error', error: 'Conflict', statusCode: 409, errors: { email: ['taken'] } }, throwing(new ApiError('Conflict', 409, { errRes: { errors: { email: ['taken'] } } }))],
        ['unauthenticated', { type: 'unauthenticated' }, throwing(new UnauthenticatedUserError('Custom text'))]
    ]

    it.each(cases)('%s', async (_name, args, handler) => {
        const app = await serve((server) => server.get('/route', handler))
        const preview = (await callTool('build-api-response', args)).json()
        const real = await app.request('GET', '/route')
        await app.close()
        expect({ statusCode: preview.statusCode, body: preview.body }).toEqual({ statusCode: real.status, body: real.json })
    })

    it('server-error warns about the leak and shows the safe alternative', async () => {
        const app = await serve((server) => {
            server.get('/plain', throwing(new Error('boom')))
            server.get('/safe', throwing(new ServerError('boom')))
        })
        const preview = (await callTool('build-api-response', { type: 'server-error', error: 'boom' })).json()
        const plain = await app.request('GET', '/plain')
        const safe = await app.request('GET', '/safe')
        await app.close()

        const { serverError } = plain.json as { serverError: { stack: string } }
        expect(serverError.stack).toContain('Error: boom')
        expect(preview.statusCode).toBe(plain.status)
        expect(preview.body.serverError).toMatchObject({ name: 'Error', message: 'boom' })
        expect(preview.warning).toMatch(/stack trace/)
        expect(preview.saferAlternative).toMatchObject({ statusCode: safe.status, body: safe.json })
        // The server's own paths must not appear in a preview.
        expect(JSON.stringify(preview.body)).not.toContain(REPO_ROOT)
    })

    it.each([
        [{ type: 'validation-error' }],
        [{ type: 'invalid-value', field: 'email' }],
        [{ type: 'invalid-value', error: 'bad' }],
        [{ type: 'custom-error', error: 'x' }],
        [{ type: 'custom-error', statusCode: 409 }],
        [{ type: 'custom-error', error: 'x', statusCode: 9999 }]
    ])('rejects %j with isError rather than inventing output', async (args) => {
        const { isError } = await callTool('build-api-response', args)
        expect(isError).toBe(true)
    })

    it('a status the tool rejects really does fail in Express', async () => {
        const app = await serve((server) => {
            server.get('/route', throwing(new ApiError('x', 9999)))
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs all four parameters
            server.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
                res.status(500).json({ reachedAppHandler: true })
            })
        })
        const real = await app.request('GET', '/route')
        await app.close()
        expect(real.json).toEqual({ reachedAppHandler: true })
    })
})

describe('build-api-error matches the real classes (B9, B12)', () => {
    it('keeps every message on a repeated field', async () => {
        const output = (await callTool('build-api-error', {
            errorClass: 'ValidationError',
            message: 'Validation failed',
            fields: [{ field: 'email', message: 'bad' }, { field: 'email', message: 'worse' }, { field: 'name', message: 'short' }]
        })).json()
        const real = ApiResponseErrorsValue.getInstance().addError('email', 'bad').addError('email', 'worse').addError('name', 'short').getErrors()
        expect(output.errorResponse.errors).toEqual(real)
        expect(output.httpResponse).toEqual({ statusCode: 400, body: { errors: real, error: 'bad' } })
    })

    it('uses the message given to InvalidValueError, and says so if a field message is ignored', async () => {
        const output = (await callTool('build-api-error', {
            errorClass: 'InvalidValueError',
            message: 'bad',
            fields: [{ field: 'email', message: 'other' }]
        })).json()
        const real = new InvalidValueError('bad', { key: 'email' })
        expect(output.message).toBe(real.message)
        expect(output.errorResponse).toEqual(real.getErrorResponse())
        expect(output.notes.join()).toContain('ignored')
    })

    it('rejects entries it would otherwise drop', async () => {
        const invalid = await callTool('build-api-error', {
            errorClass: 'InvalidValueError',
            message: 'bad',
            fields: [{ field: 'a', message: 'x' }, { field: 'b', message: 'y' }]
        })
        expect(invalid.isError).toBe(true)
        expect((await callTool('build-api-error', { errorClass: 'ServerError', message: 'x', fields: [{ field: 'a', message: 'y' }] })).isError).toBe(true)
    })

    it('shows that UnauthenticatedUserError discards its message', async () => {
        const output = (await callTool('build-api-error', { errorClass: 'UnauthenticatedUserError', message: 'Session expired' })).json()
        expect(output.httpResponse).toEqual({ statusCode: 401, body: { errorCode: 'unauthenticated', message: 'Unauthenticated' } })
        expect(output.notes.join()).toContain('isn\'t sent')
    })

    it('supports ApiError with a status code', async () => {
        const output = (await callTool('build-api-error', { errorClass: 'ApiError', message: 'Conflict', statusCode: 409 })).json()
        expect(output.httpResponse).toEqual({ statusCode: 409, body: { message: 'Conflict' } })
        expect((await callTool('build-api-error', { errorClass: 'ApiError', message: 'x' })).isError).toBe(true)
    })
})

describe('build-crypto-snippet output runs (B6, B13, B14)', () => {
    const ec = ecPair()
    const ecJwe = ecPair()
    const secret = 'x'.repeat(64)
    const modules = { '@qnx/crypto': qnxCrypto as unknown as Record<string, unknown> }

    const withEnv = async (env: Record<string, string>, run: () => Promise<unknown>) => {
        const saved = { ...process.env }
        Object.assign(process.env, env)
        try { return await run() } finally { process.env = saved }
    }

    const generate = async (args: Record<string, unknown>) => {
        const result = await callTool('build-crypto-snippet', args)
        expect(result.text, JSON.stringify(args)).not.toMatch(/^Error/)
        return result.json().snippet as string
    }

    it.each(['HS256', 'HS384', 'HS512'])('jwt sign then verify with %s', async (alg) => {
        const env = { JWT_SECRET: secret }
        const signSnippet = await generate({ operation: 'jwt-sign', keyType: 'symmetric', alg, payload: { a: 1 }, expirationTime: '2h', subject: 's', issuer: 'i', jti: 'j' })
        const verifySnippet = await generate({ operation: 'jwt-verify', keyType: 'symmetric', alg })
        await withEnv(env, async () => {
            const token = await runSnippet(signSnippet, modules, {}, 'return token')
            const payload = await runSnippet(verifySnippet, modules, { token }, 'return payload') as Record<string, unknown>
            expect(jose.decodeProtectedHeader(token as string).alg).toBe(alg)
            expect(payload).toMatchObject({ a: 1, sub: 's', iss: 'i', jti: 'j' })
            expect(payload.exp).toBeTypeOf('number')
        })
    })

    it.each([
        ['ES256', () => ecPair('P-256')],
        ['ES384', () => ecPair('P-384')],
        ['RS256', rsaPair],
        ['PS256', rsaPair]
    ])('jwt sign then verify with %s, including every non-default algorithm', async (alg, makeKeys) => {
        const keys = makeKeys()
        const signSnippet = await generate({ operation: 'jwt-sign', keyType: 'asymmetric', alg, payload: { a: 1 } })
        const verifySnippet = await generate({ operation: 'jwt-verify', keyType: 'asymmetric', alg })
        await withEnv({ JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey }, async () => {
            const token = await runSnippet(signSnippet, modules, {}, 'return token')
            const payload = await runSnippet(verifySnippet, modules, { token }, 'return payload')
            expect(jose.decodeProtectedHeader(token as string).alg).toBe(alg)
            expect(payload).toMatchObject({ a: 1 })
        })
    })

    it('jwt-sign defaults run, with no invented payload', async () => {
        const symmetric = await generate({ operation: 'jwt-sign', keyType: 'symmetric' })
        const asymmetric = await generate({ operation: 'jwt-sign', keyType: 'asymmetric' })
        expect(symmetric + asymmetric).not.toContain('userId')
        await withEnv({ JWT_SECRET: secret, JWT_PRIVATE_KEY: ec.privateKey }, async () => {
            expect(await runSnippet(symmetric, modules, {}, 'return token')).toBeTypeOf('string')
            expect(await runSnippet(asymmetric, modules, {}, 'return token')).toBeTypeOf('string')
        })
    })

    it.each([
        ['ECDH-ES+A128KW', () => ecPair(), undefined],
        ['ECDH-ES', () => ecPair(), 'A256GCM'],
        ['RSA-OAEP', rsaPair, 'A256GCM'],
        ['RSA-OAEP-256', rsaPair, undefined]
    ])('jwe encrypt then decrypt with %s', async (alg, makeKeys, enc) => {
        const keys = makeKeys()
        const plaintext = 'it\'s "secret"\n`x`${y}'
        const encrypt = await generate({ operation: 'jwe-encrypt', plaintext, alg, ...(enc && { enc }) })
        const decrypt = await generate({ operation: 'jwe-decrypt', alg })
        await withEnv({ JWE_PUBLIC_KEY: keys.publicKey, JWE_PRIVATE_KEY: keys.privateKey }, async () => {
            const jwe = await runSnippet(encrypt, modules, {}, 'return jwe')
            expect(await runSnippet(decrypt, modules, { jwe }, 'return plaintext')).toBe(plaintext)
        })
    })

    it.each([['A128KW', 16], ['A192KW', 24], ['A256KW', 32]] as const)('jwe with symmetric %s', async (alg, bytes) => {
        const encrypt = await generate({ operation: 'jwe-encrypt', plaintext: 'hi', alg, enc: 'A256GCM' })
        const decrypt = await generate({ operation: 'jwe-decrypt', alg })
        await withEnv({ JWE_SECRET: 'k'.repeat(bytes) }, async () => {
            const jwe = await runSnippet(encrypt, modules, {}, 'return jwe')
            expect(await runSnippet(decrypt, modules, { jwe }, 'return plaintext')).toBe('hi')
        })
    })

    it('auth token snippets run', async () => {
        const generateSnippet = await generate({ operation: 'auth-token-generate', subject: 'user-1' })
        const decryptSnippet = await generate({ operation: 'auth-token-decrypt' })
        await withEnv({ JWT_PRIVATE_KEY: ec.privateKey, JWT_PUBLIC_KEY: ec.publicKey, JWE_PUBLIC_KEY: ecJwe.publicKey, JWE_PRIVATE_KEY: ecJwe.privateKey }, async () => {
            const { token } = await runSnippet(generateSnippet, modules, {}, 'return { token, dbToken }') as { token: string }
            const decoded = decryptSnippet.replace('const payload =', 'var payload =').replace('const userId =', 'var userId =')
            expect(await runSnippet(decoded, modules, { token }, 'return userId')).toBe('user-1')
        })
    })

    it.each([
        ['symmetric with ES256', { operation: 'jwt-sign', keyType: 'symmetric', alg: 'ES256' }],
        ['asymmetric with HS256', { operation: 'jwt-sign', keyType: 'asymmetric', alg: 'HS256' }],
        ['alg none', { operation: 'jwt-sign', keyType: 'symmetric', alg: 'none' }],
        ['bad expiry', { operation: 'jwt-sign', keyType: 'symmetric', expirationTime: 'banana' }],
        ['bad JWE alg', { operation: 'jwe-encrypt', plaintext: 'x', alg: 'none' }],
        ['bad enc', { operation: 'jwe-encrypt', plaintext: 'x', enc: 'none' }],
        ['verify with mismatched alg', { operation: 'jwt-verify', keyType: 'symmetric', alg: 'RS256' }],
        ['missing keyType', { operation: 'jwt-sign' }],
        ['missing plaintext', { operation: 'jwe-encrypt' }],
        ['missing subject', { operation: 'auth-token-generate' }]
    ])('rejects %s with isError', async (_name, args) => {
        const { isError, text } = await callTool('build-crypto-snippet', args)
        expect(isError).toBe(true)
        expect(text).toMatch(/^Error/)
    })

    it('says plainly that auth tokens do not expire, which is true', async () => {
        await withEnv({ JWT_PRIVATE_KEY: ec.privateKey, JWT_PUBLIC_KEY: ec.publicKey, JWE_PUBLIC_KEY: ecJwe.publicKey, JWE_PRIVATE_KEY: ecJwe.privateKey }, async () => {
            const { token } = await generateAuthToken('u')
            const payload = await decryptAuthToken(token)
            expect(payload.exp).toBeUndefined()
            expect(Object.keys(payload).sort()).toEqual(['iat', 'jti', 'sub'])
        })
        const generated = (await callTool('build-crypto-snippet', { operation: 'auth-token-generate', subject: 'u' })).json()
        const decrypted = (await callTool('build-crypto-snippet', { operation: 'auth-token-decrypt' })).json()
        const docs = (await callTool('get-crypto-docs', { topic: 'auth-token' })).text
        expect(generated.notes.join()).toMatch(/no expiry/)
        expect(decrypted.snippet).not.toMatch(/invalid, expired/)
        expect(docs).toMatch(/never expire/)
    })

    it('every snippet compiles under tsc --strict', async () => {
        const args: Record<string, Record<string, unknown>> = {
            signSym: { operation: 'jwt-sign', keyType: 'symmetric', payload: { a: 1 }, expirationTime: '2h' },
            signAsym: { operation: 'jwt-sign', keyType: 'asymmetric', issuer: 'i', jti: 'j' },
            signRs: { operation: 'jwt-sign', keyType: 'asymmetric', alg: 'RS256' },
            verifySym: { operation: 'jwt-verify', keyType: 'symmetric' },
            verifyAsym: { operation: 'jwt-verify', keyType: 'asymmetric', alg: 'RS256' },
            encrypt: { operation: 'jwe-encrypt', plaintext: 'x' },
            encryptEnc: { operation: 'jwe-encrypt', plaintext: 'x', enc: 'A128GCM' },
            encryptSym: { operation: 'jwe-encrypt', plaintext: 'x', alg: 'A256KW' },
            decrypt: { operation: 'jwe-decrypt' },
            decryptSym: { operation: 'jwe-decrypt', alg: 'A256KW' },
            tokenGenerate: { operation: 'auth-token-generate', subject: 's' },
            tokenDecrypt: { operation: 'auth-token-decrypt' }
        }
        const snippets: Record<string, string> = {}
        for (const [name, input] of Object.entries(args)) {
            // What each snippet expects to already exist in the developer's code.
            const inputs = String(input.operation).endsWith('verify') || String(input.operation).endsWith('token-decrypt')
                ? 'declare const token: string\n'
                : input.operation === 'jwe-decrypt' ? 'declare const jwe: string\n' : ''
            snippets[name] = inputs + await generate(input)
        }
        expect(compileStrict(snippets, REPO_ROOT)).toEqual([])
    }, 120_000)
})

describe('crypto docs (B14, B15, B17)', () => {
    it('install commands name every peer dependency', async () => {
        expect((await callTool('get-crypto-docs', { topic: 'overview' })).text).toContain('npm install @qnx/crypto jose uuid')
        expect((await callTool('get-response-docs', { pattern: 'install' })).text).toContain('npm install @qnx/response @qnx/errors express zod@4')
        expect((await callTool('get-error-class-docs', { errorClass: 'install' })).text).toContain('npm install @qnx/errors')
        expect((await callTool('get-client-docs', { topic: 'install' })).text).toContain('npm install @qnx/client')
    })

    it('the key generation script produces keys that work once its .env lines are loaded', async () => {
        const docs = (await callTool('get-crypto-docs', { topic: 'setup' })).text
        const [script] = fencedBlocks(docs, 'js')
        const printed: string[] = []
        await runSnippet(script, { 'node:crypto': await import('node:crypto') }, { console: { log: (line: string) => printed.push(line) } })
        expect(printed).toHaveLength(4)

        const { parseEnv } = await import('node:util')
        const parsed = parseEnv(printed.join('\n')) as Record<string, string>
        const key = await toPKCS8Secret(parsed.JWT_PRIVATE_KEY, 'ES256')
        const token = await jwtSign({ a: 1 }, key, { expirationTime: '1h' })
        await jwtVerify(token, await toSPKISecret(parsed.JWT_PUBLIC_KEY, 'ES256'))

        const jwe = await jweEncrypt('hi', await toSPKISecret(parsed.JWE_PUBLIC_KEY, 'ECDH-ES+A128KW'))
        const { plaintext } = await jweDecrypt(jwe, await toPKCS8Secret(parsed.JWE_PRIVATE_KEY, 'ECDH-ES+A128KW'))
        expect(plaintext).toBe('hi')
    })

    it('the documented conversion fixes a PEM with literal \\n', async () => {
        const docs = (await callTool('get-crypto-docs', { topic: 'setup' })).text
        const conversion = fencedBlocks(docs, 'ts')[0]
        const { privateKey } = ecPair()
        const literal = privateKey.replace(/\n/g, '\\n')
        await expect(toPKCS8Secret(literal, 'ES256')).rejects.toThrow()

        const saved = process.env.JWT_PRIVATE_KEY
        process.env.JWT_PRIVATE_KEY = literal
        await runSnippet(conversion, {})
        await expect(toPKCS8Secret(process.env.JWT_PRIVATE_KEY, 'ES256')).resolves.toBeDefined()
        if (saved === undefined) delete process.env.JWT_PRIVATE_KEY
        else process.env.JWT_PRIVATE_KEY = saved
    })

    it('documents symmetric JWE the way the library behaves', async () => {
        const key = toSymmetricSecret('k'.repeat(32))
        const jwe = await jweEncrypt('hi', key, { alg: 'A256KW', enc: 'A256GCM' })
        expect((await jweDecrypt(jwe, key)).plaintext).toBe('hi')
        await expect(jweEncrypt('hi', toSymmetricSecret('short'), { alg: 'A256KW', enc: 'A256GCM' })).rejects.toThrow()

        const docs = (await callTool('get-crypto-docs', { topic: 'key-helpers' })).text
        expect(docs).not.toContain('Do NOT use for JWE')
        expect(docs).not.toContain('my-secret-string')
    })
})

describe('@qnx/client guidance classifies every real response (B3)', () => {
    let app: Awaited<ReturnType<typeof serve>>
    let apiRequest: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>

    beforeAll(async () => {
        const { ApiResponse: _unused, ...responseModule } = qnxResponse
        void _unused
        app = await serve((server) => {
            const handler = asyncValidatorHandler
            server.get('/data', handler(async () => ({ id: 1 })))
            server.delete('/delete', handler(async () => responseModule.initializeApiResponse().setMessage('Deleted.')))
            server.get('/validation', handler(async () => { throw new InvalidValueError('Bad email.', { key: 'email' }) }))
            server.get('/unauth', handler(async () => { throw new UnauthenticatedUserError('x') }))
            server.get('/conflict', handler(async () => { throw new ApiError('Conflict.', 409) }))
            server.get('/server', handler(async () => { throw new ServerError('Safe message.') }))
            server.get('/unexpected', handler(async () => { throw new Error('secret detail') }))
            server.get('/void', handler(async () => undefined))
            server.post('/needs-body', handler(async (req) => z.object({ name: z.string() }).parse(req.body)))
        })
        for (const docs of [
            (await callTool('get-client-docs', { topic: 'handling-responses' })).text,
            (await callTool('get-guide', { topic: 'server-and-client' })).text
        ]) {
            const helper = fencedBlocks(docs, 'ts')[0]
            apiRequest = await runSnippet(
                helper,
                { '@qnx/client': qnxClient as unknown as Record<string, unknown> },
                { fetch: (path: string, init?: RequestInit) => fetch(app.base + path, init) },
                'return apiRequest'
            ) as typeof apiRequest
        }
    })

    afterAll(() => app.close())

    it.each([
        ['/data', 'GET', { ok: true, data: { id: 1 } }],
        ['/delete', 'DELETE', { ok: true, message: 'Deleted.' }],
        ['/validation', 'GET', { ok: false, status: 400, message: 'Bad email.', fieldErrors: { email: ['Bad email.'] } }],
        ['/unauth', 'GET', { ok: false, status: 401, message: 'Unauthenticated', errorCode: 'unauthenticated' }],
        ['/conflict', 'GET', { ok: false, status: 409, message: 'Conflict.' }],
        ['/server', 'GET', { ok: false, status: 500, message: 'Safe message.' }],
        ['/unexpected', 'GET', { ok: false, status: 500, message: 'Something went wrong.' }],
        ['/void', 'GET', { ok: false, status: 404, message: 'Something went wrong.' }]
    ])('%s', async (path, method, expected) => {
        expect(await apiRequest(path, { method })).toMatchObject(expected)
    })

    it('sends the Content-Type a JSON route needs', async () => {
        const result = await apiRequest('/needs-body', { method: 'POST', body: JSON.stringify({ name: 'a' }) })
        expect(result).toMatchObject({ ok: true, data: { name: 'a' } })
    })

    it('the documented table is what really happens, and no doc recommends the old checks', async () => {
        const raw = async (path: string) => (await fetch(app.base + path)).json()
        const res = (body: unknown) => new qnxClient.ApiResponse(body as qnxClient.ApiResponseValue)
        for (const path of ['/unauth', '/conflict', '/server', '/unexpected']) {
            expect(res(await raw(path)).getError(), path).toBeUndefined()
        }
        const docs = (await callTool('get-client-docs', { topic: 'all' })).text
        expect(docs).not.toContain('always defined')
        expect(fencedBlocks(docs, 'ts').join()).not.toMatch(/if \(!raw\.data\)|if \(res\.getError\(\)\)/)
        expect(fencedBlocks(docs, 'ts').filter((block) => block.includes('method: \'POST\'')).every((block) => block.includes('Content-Type'))).toBe(true)
    })
})

describe('get-package-info is accurate for every published package', () => {
    const readPackage = (name: string) => JSON.parse(readFileSync(resolve(REPO_ROOT, 'packages', name.replace('@qnx/', ''), 'package.json'), 'utf8'))

    /** Every export from the package's source, including types, read with the TypeScript checker. */
    function sourceExports(name: string) {
        const file = resolve(REPO_ROOT, 'packages', name.replace('@qnx/', ''), 'src/index.ts')
        const program = ts.createProgram([file], { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, noEmit: true })
        const checker = program.getTypeChecker()
        const source = program.getSourceFile(file) as ts.SourceFile
        return checker.getExportsOfModule(checker.getSymbolAtLocation(source) as ts.Symbol).map((symbol) => symbol.name)
    }

    it('lists every public package in the repo, and no placeholder', async () => {
        const published = readdirSync(resolve(REPO_ROOT, 'packages'))
            .filter((name) => !['mcp', 'my-lib'].includes(name) && existsSync(resolve(REPO_ROOT, 'packages', name, 'package.json')))
            .map((name) => `@qnx/${name}`)
        expect(packages.map(({ name }) => name).sort()).toEqual(published.sort())
        const { text } = await callTool('get-package-info', { package: 'all' })
        for (const name of published) expect(text).toContain(name)
        expect(text).not.toContain('my-lib')
    })

    it.each(packages.map((info) => [info.name, info] as const))('%s', async (name, info) => {
        const manifest = readPackage(name)
        expect([...info.peerDependencies].sort(), 'peer dependencies').toEqual(Object.keys(manifest.peerDependencies ?? {}).sort())
        for (const peer of info.peerDependencies) expect(info.install, 'install command').toContain(peer)
        expect(info.install).toContain(name)

        const documented = info.exports.map((entry) => entry.name)
        const exported = sourceExports(name)
        expect(exported.filter((item) => !documented.includes(item)), 'undocumented exports').toEqual([])
        // The published .d.ts also exports types the source doesn't, which e2e/consumer.mjs checks.
        expect(info.exports.filter((entry) => entry.kind !== 'type' && !exported.includes(entry.name)), 'exports that do not exist').toEqual([])

        const { text } = await callTool('get-package-info', { package: name })
        for (const item of documented) expect(text).toContain(item)
        expect(text).toContain(info.install)
    }, 60_000)

    it('rejects an unknown package and lists the valid names', async () => {
        const { isError, text } = await callTool('get-package-info', { package: 'nope' })
        expect(isError).toBe(true)
        expect(text).toContain('@qnx/response')
    })

    it('the examples behave as they say', async () => {
        const { asyncSubArrayGenerator, collectTypeValue, isFunction } = await import('@qnx/core-helpers')
        const chunks: number[][] = []
        for await (const chunk of asyncSubArrayGenerator([1, 2, 3, 4, 5], 2)) chunks.push(chunk)
        expect(chunks).toEqual([[1, 2], [3, 4], [5]])
        expect(collectTypeValue('42', 0)).toBe(42)
        expect(collectTypeValue(undefined, 10)).toBe(10)
        expect(collectTypeValue(null, 'fallback')).toBe('fallback')
        expect(collectTypeValue('abc', 0)).toBeNaN()
        expect(collectTypeValue(42, 'text')).toBe(42)
        expect(isFunction(() => undefined)).toBe(true)
        await expect(asyncSubArrayGenerator([1], 0).next()).rejects.toThrow(RangeError)

        const { requiredField, message } = await import('@qnx/message')
        expect(requiredField('Email')).toBe('Email is a required field.')
        expect(message()).toBe('message')
    })

    it('every example compiles under tsc --strict', () => {
        const snippets = Object.fromEntries(packages.filter(({ example }) => example).map(({ name, example }) => [name.replace('@qnx/', ''), example as string]))
        expect(compileStrict(snippets, REPO_ROOT)).toEqual([])
    }, 120_000)

    it('every docs pointer resolves to a real call', async () => {
        for (const { name, docsTool } of packages) {
            const call = docsTool && /^(\S+) (\{.*\})$/.exec(docsTool)
            if (call) expect((await callTool(call[1], JSON.parse(call[2]))).isError, name).toBe(false)
        }
    })
})

describe('guides compile under tsc --strict', () => {
    it('as a developer would paste them', async () => {
        const blocks: Record<string, string> = {}
        for (const topic of ['crud-api', 'server-and-client', 'auth-session']) {
            const { text } = await callTool('get-guide', { topic })
            fencedBlocks(text).forEach((block, index) => {
                blocks[`${topic}-${index}`] = `declare function checkCredentials(body: unknown): Promise<{ id: number }>\n${block}`
            })
        }
        const docs = (await callTool('get-client-docs', { topic: 'handling-responses' })).text
        blocks.handling = fencedBlocks(docs)[0]
        const safeHandler = fencedBlocks((await callTool('get-response-docs', { pattern: 'server-error' })).text, 'typescript')[0]
        blocks.safeHandler = safeHandler
        expect(compileStrict(blocks, REPO_ROOT)).toEqual([])
    }, 120_000)
})

describe('@qnx/log docs', () => {
    it('describe the signature the library has', async () => {
        expect((await callTool('get-console-log-docs', { topic: 'types' })).text).toContain('consoleLog(message: unknown')
    })
})

describe('transform-to-async-handler keeps behaviour (B4)', () => {
    const missingUser = { findById: async () => null, create: async (body: object) => ({ id: 7, ...body }), update: async () => { throw new Error('secret db detail') } }
    const modules = {
        '@qnx/response': qnxResponse as unknown as Record<string, unknown>,
        '@qnx/errors': qnxErrors as unknown as Record<string, unknown>
    }

    const parts = (text: string) => {
        const blocks = fencedBlocks(text, 'typescript')
        return { before: blocks[0], after: blocks[1] }
    }

    async function compare(pattern: string, method: string, path: string, scope: Record<string, unknown>, handler?: express.ErrorRequestHandler) {
        const { text } = await callTool('transform-to-async-handler', { pattern })
        const { before, after } = parts(text)
        const build = async (code: string) => {
            const router = express.Router()
            await runSnippet(code, modules, { router, ...scope })
            return router
        }
        const app = await serve(() => undefined)
        await app.close()
        const beforeRouter = await build(before)
        const afterRouter = await build(after)
        const server = await serve((instance) => {
            instance.use('/before', beforeRouter)
            instance.use('/after', afterRouter)
            if (handler) instance.use(handler)
        })
        const results = [await server.request(method, `/before${path}`, method === 'GET' ? undefined : {}), await server.request(method, `/after${path}`, method === 'GET' ? undefined : {})]
        await server.close()
        return { text, before: results[0], after: results[1] }
    }

    it('callback-try-catch keeps the 201', async () => {
        const { before, after } = await compare('callback-try-catch', 'POST', '/users', { User: missingUser })
        expect(before.status).toBe(201)
        expect(after.status).toBe(201)
        expect(after.json).toEqual(before.json)
    })

    it('promise-chain keeps the 404 and reports the body change', async () => {
        const { before, after, text } = await compare('promise-chain', 'GET', '/users/9', { User: missingUser })
        expect(before.status).toBe(404)
        expect(after.status).toBe(404)
        expect(before.json).toEqual({ error: 'Not found' })
        expect(after.json).toEqual({ message: 'Not found' })
        expect(text).toContain('404 body')
    })

    it('express-next still reaches the app error handler and sends no stack', async () => {
        let hits = 0
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs all four parameters
        const handler: express.ErrorRequestHandler = (_err, _req, res, _next) => {
            hits++
            res.status(500).json({ error: 'sanitized' })
        }
        const { before, after } = await compare('express-next', 'PUT', '/users/9', { User: missingUser }, handler)
        expect(hits).toBe(2)
        expect(before.json).toEqual({ error: 'sanitized' })
        expect(after.json).toEqual({ error: 'sanitized' })
        expect(after.text).not.toContain('secret db detail')
    })

    it('express-next success responds the same as before', async () => {
        const { before, after } = await compare('express-next', 'PUT', '/users/9', { User: { update: async () => ({ id: 9 }) } })
        expect(before.status).toBe(200)
        expect(after.json).toEqual(before.json)
    })

    it('callback-query success responds the same as before', async () => {
        const rows = [{ id: 1 }]
        const { before, after } = await compare('callback-query', 'GET', '/users', {
            connection: { query: (_sql: string, callback: (err: null, rows: unknown[]) => void) => callback(null, rows) },
            db: { query: async () => rows }
        })
        expect(before.json).toEqual({ data: rows })
        expect(after.json).toEqual(before.json)
    })

    it('every pattern lists the behaviour changes to check', async () => {
        for (const pattern of ['callback-query', 'callback-try-catch', 'promise-chain', 'express-next']) {
            expect((await callTool('transform-to-async-handler', { pattern })).text, pattern).toContain('Behaviour changes to check')
        }
    })

    it('uses the code it is given: different code gives different output', async () => {
        const created = (await callTool('transform-to-async-handler', { code: `router.post('/orders', async (req, res) => {
    try {
        const order = await Order.create(req.body)
        res.status(201).json({ data: order, message: 'Order placed.' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})` })).text
        const notFound = (await callTool('transform-to-async-handler', { code: `router.get('/orders/:id', (req, res) => {
    Order.find(req.params.id).then(order => {
        if (!order) return res.status(404).json({ error: 'No such order' })
        res.json({ data: order })
    })
})` })).text

        expect(created).toContain('ApiResponse.getInstance().setStatusCode(201).setData(order).setMessage(\'Order placed.\')')
        expect(created).toContain('`callback-try-catch`')
        expect(notFound).toContain('throw new ApiError(\'No such order\', 404)')
        expect(notFound).toContain('initializeApiResponse().setData(order)')
        expect(notFound).toContain('`promise-chain`')
        expect(created).not.toEqual(notFound)
    })

    it('reports on unusual routes rather than inventing a migration', async () => {
        expect(analyzeLegacyRoute('const a = 1').conversions).toEqual([])
        expect((await callTool('transform-to-async-handler', { code: 'const a = 1' })).text).toContain('No Express route patterns')
        expect((await callTool('transform-to-async-handler', {})).isError).toBe(true)
        const conversions = analyzeLegacyRoute(`res.status(401).json({ error: 'Nope' }); res.status(422).json({ error: 'Bad' }); res.json({ users }); res.sendStatus(204)`).conversions
        expect(conversions.map(({ becomes }) => becomes)).toEqual([
            `throw new UnauthenticatedUserError('Nope')`,
            `throw new InvalidValueError('Bad', { key: 'fieldName' })`,
            'return initializeApiResponse().setData({ users })',
            `return ApiResponse.getInstance().setStatusCode(204).setMessage('...')`
        ])
    })
})

describe('get-guide code runs against the real packages', () => {
    const modules = {
        express: Object.assign(express, { default: express }) as unknown as Record<string, unknown>,
        zod: { z },
        '@qnx/response': qnxResponse as unknown as Record<string, unknown>,
        '@qnx/errors': qnxErrors as unknown as Record<string, unknown>,
        '@qnx/crypto': qnxCrypto as unknown as Record<string, unknown>
    }

    it('crud-api responds as its table says', async () => {
        const [code] = fencedBlocks((await callTool('get-guide', { topic: 'crud-api' })).text)
        const guideApp = await runSnippet(code, modules, {}, 'return app') as express.Express
        const server = await serve((app) => app.use(guideApp))

        expect((await server.request('GET', '/items')).json).toEqual({ data: [{ id: 1, name: 'First' }] })
        expect(await server.request('GET', '/items/99')).toMatchObject({ status: 404, json: { message: 'Item not found.' } })
        expect(await server.request('POST', '/items', { name: 'New' })).toMatchObject({ status: 201, json: { data: { id: 2, name: 'New' }, message: 'Created.' } })
        const invalid = await server.request('POST', '/items', { name: '' })
        expect(invalid.status).toBe(400)
        expect(invalid.json).toHaveProperty('errors.name')
        expect(await server.request('PUT', '/items/1', { name: 'Renamed' })).toMatchObject({ status: 200, json: { data: { id: 1, name: 'Renamed' } } })
        expect(await server.request('DELETE', '/items/1')).toMatchObject({ status: 200, json: { message: 'Deleted.' } })
        await server.close()
    })

    it('auth-session logs in, enforces expiry, and logs out', async () => {
        const jwt = ecPair()
        const jwe = ecPair()
        Object.assign(process.env, { JWT_PRIVATE_KEY: jwt.privateKey, JWT_PUBLIC_KEY: jwt.publicKey, JWE_PUBLIC_KEY: jwe.publicKey, JWE_PRIVATE_KEY: jwe.privateKey })
        // Keys are cached after first use, so this has to be the suite's first auth token with these keys.
        const [code] = fencedBlocks((await callTool('get-guide', { topic: 'auth-session' })).text)
        const { router, sessions } = await runSnippet(code, modules, {
            checkCredentials: async () => ({ id: 42 })
        }, 'return { router, sessions }') as { router: express.Router; sessions: Map<string, { expiresAt: number }> }

        const server = await serve((app) => app.use(router))
        const authed = (token: string, path: string, method = 'GET') => fetch(server.base + path, { method, headers: { Authorization: `Bearer ${token}` } })

        const login = await server.request('POST', '/login', { user: 'a', password: 'b' })
        const { token } = (login.json as { data: { token: string } }).data
        expect(login.status).toBe(200)
        expect((await (await authed(token, '/me')).json())).toEqual({ data: { userId: '42' } })
        expect((await server.request('GET', '/me')).status).toBe(401)
        expect((await authed('garbage', '/me')).status).toBe(401)

        const second = ((await server.request('POST', '/login', {})).json as { data: { token: string } }).data.token
        for (const session of sessions.values()) session.expiresAt = 0
        expect((await authed(second, '/me')).status).toBe(401)

        const third = ((await server.request('POST', '/login', {})).json as { data: { token: string } }).data.token
        expect((await authed(third, '/logout', 'POST')).status).toBe(200)
        expect((await authed(third, '/me')).status).toBe(401)
        await server.close()
    })

    it('safeHandler keeps details on the server and lets client errors through', async () => {
        const docs = (await callTool('get-response-docs', { pattern: 'server-error' })).text
        const [code] = fencedBlocks(docs, 'typescript')
        const logged: unknown[][] = []
        const safeHandler = await runSnippet(code, {
            '@qnx/response': { ...qnxResponse, setCallback: () => undefined } as unknown as Record<string, unknown>,
            '@qnx/errors': qnxErrors as unknown as Record<string, unknown>,
            '@qnx/winston': { logger: { error: (...args: unknown[]) => logged.push(args) } },
            zod: { ZodError: z.ZodError },
            express: {}
        }, {}, 'return safeHandler') as (route: () => Promise<unknown>) => express.RequestHandler

        const server = await serve((app) => {
            app.get('/unexpected', safeHandler(async () => { throw new Error('password=hunter2') }))
            app.get('/conflict', safeHandler(async () => { throw new ApiError('Conflict.', 409) }))
            app.get('/zod', safeHandler(async () => z.string().parse(1)))
            app.get('/ok', safeHandler(async () => ({ id: 1 })))
        })
        const unexpected = await server.request('GET', '/unexpected')
        expect(unexpected).toMatchObject({ status: 500, json: { message: 'Internal server error' } })
        expect(unexpected.text).not.toContain('hunter2')
        expect(logged).toHaveLength(1)
        expect(await server.request('GET', '/conflict')).toMatchObject({ status: 409, json: { message: 'Conflict.' } })
        expect((await server.request('GET', '/zod')).status).toBe(400)
        expect((await server.request('GET', '/ok')).json).toEqual({ data: { id: 1 } })
        await server.close()
    })

    it('rejects unknown guides, and scopes the list', async () => {
        expect((await callTool('get-guide', { topic: 'nope' })).isError).toBe(true)
        expect((await callTool('get-guide', { topic: 'auth-session' }, { log: true })).isError).toBe(true)
        expect((await callTool('get-guide', { topic: 'production-checklist' }, { log: true })).isError).toBe(false)
    })
})

describe('@qnx/response docs state real behaviour (B5, B8, B16)', () => {
    it('states the real 401 default', async () => {
        expect(qnxErrors.errorCodes.UNAUTHENTICATED_USER_ERROR_CODE).toBe(401)
        const text = (await callTool('get-response-docs', { pattern: 'unauthenticated' })).text
        expect(text).toContain('default 401')
        expect(text).not.toContain('default 500')
    })

    it('explains the HTML 404 from a handler returning nothing, which is real', async () => {
        const server = await serve((app) => app.delete('/x', asyncValidatorHandler(async () => undefined)))
        const real = await server.request('DELETE', '/x')
        await server.close()
        expect(real.status).toBe(404)
        expect(real.text).toContain('Cannot DELETE /x')
        expect((await callTool('get-response-docs', { pattern: 'handler-return-values' })).text).toContain('HTML 404')
    })

    it('warns about the stack trace and explains the choices', async () => {
        const text = (await callTool('get-response-docs', { pattern: 'server-error' })).text
        for (const expected of ['setCallback', 'ServerError', 'stack trace', 'safeHandler']) expect(text).toContain(expected)
    })

    it('has an all option that covers every pattern', async () => {
        const { text } = await callTool('get-response-docs', { pattern: 'all' })
        for (const pattern of ['install', 'handler-return-values', 'server-error', 'resource-route', 'api-reference']) {
            expect(text).toContain(`## ${pattern}`)
        }
    })

    it('states what setError really does', async () => {
        const real = ApiResponseErrorsValue.getInstance().setError('a', '1').setError('b', '2').getErrors()
        expect(real).toEqual({ b: ['2'] })
        expect((await callTool('get-error-class-docs', { errorClass: 'ApiResponseErrorsValue' })).text).toMatch(/Replaces everything/)
    })

    it('imports what its auth example uses', async () => {
        const text = (await callTool('get-crypto-docs', { topic: 'auth-token' })).text
        expect(text).toContain(`import { UnauthenticatedUserError } from '@qnx/errors'`)
    })
})

describe('documentation covers every public export', () => {
    const exportsOf = (module: object) => Object.keys(module).filter((name) => name !== 'default')

    it.each([
        ['@qnx/response', () => qnxResponse, 'get-response-docs', { pattern: 'all' }],
        ['@qnx/errors', () => qnxErrors, 'get-error-class-docs', { errorClass: 'all' }],
        ['@qnx/client', () => qnxClient, 'get-client-docs', { topic: 'all' }],
        ['@qnx/crypto', () => qnxCrypto, 'get-crypto-docs', { topic: 'all' }],
        ['@qnx/log', () => qnxLog, 'get-console-log-docs', { topic: 'all' }]
    ] as const)('%s', async (_name, getModule, tool, args) => {
        const { text } = await callTool(tool, args)
        const missing = exportsOf(getModule()).filter((name) => !text.includes(name))
        expect(missing).toEqual([])
    })
})

describe('diagnose-error recognises what the libraries really throw', () => {
    /** Runs code that should fail and returns the text a developer would paste. */
    const failure = async (run: () => unknown) => {
        try {
            await run()
        } catch (error) {
            const { name, message, code } = error as { name: string; message: string; code?: string }
            return `${name}${code ? ` [${code}]` : ''}: ${message}`
        }
        throw new Error('Expected this to fail')
    }

    const { privateKey, publicKey } = ecPair()
    const secret = toSymmetricSecret('x'.repeat(32))

    const reproductions: [string, () => unknown][] = [
        ['pem-literal-newlines', () => toPKCS8Secret(privateKey.replace(/\n/g, '\\n'), 'ES256')],
        ['pem-wrong-format', () => toPKCS8Secret(publicKey, 'ES256')],
        ['pem-wrong-format', () => toSPKISecret(privateKey, 'ES256')],
        ['pem-corrupt', () => toPKCS8Secret('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----', 'ES256')],
        ['aes-key-length', () => jweEncrypt('hi', toSymmetricSecret('short'), { alg: 'A256KW', enc: 'A256GCM' })],
        ['curve-mismatch', async () => jwtSign({}, await toPKCS8Secret(ecPair('P-384').privateKey, 'ES256'))],
        ['symmetric-secret-without-alg', () => jwtSign({}, secret)],
        ['imported-key-without-alg', async () => jwtSign({}, await toPKCS8Secret(rsaPair().privateKey, 'RS256'))],
        ['alg-not-supported', () => jwtSign({}, secret, { alg: 'none' })],
        ['alg-not-supported', async () => jwtSign({}, await toPKCS8Secret(privateKey, 'HS256'))],
        ['invalid-time-period', () => jwtSign({}, secret, { alg: 'HS256', expirationTime: 'banana' })],
        ['jwt-expired', async () => jwtVerify(await jwtSign({}, secret, { alg: 'HS256', expirationTime: '-1s' }), secret)],
        ['jwt-claim-failed', async () => jwtVerify(await jwtSign({}, secret, { alg: 'HS256', issuer: 'a' }), secret, { issuer: 'b' })],
        ['jws-signature-failed', async () => jwtVerify(await jwtSign({}, secret, { alg: 'HS256' }), toSymmetricSecret('y'.repeat(32)))],
        ['jwe-decryption-failed', async () => {
            const encrypted = await jweEncrypt('hi', await toSPKISecret(publicKey, 'ECDH-ES+A128KW'))
            return jweDecrypt(encrypted, await toPKCS8Secret(ecPair().privateKey, 'ECDH-ES+A128KW'))
        }],
        ['malformed-token', () => jwtVerify('garbage', secret)],
        ['malformed-token', async () => jweDecrypt('garbage', await toPKCS8Secret(privateKey, 'ECDH-ES+A128KW'))],
        ['handler-not-a-function', async () => {
            const server = await serve((app) => app.get('/x', asyncValidatorHandler(undefined as never)))
            const { text } = await server.request('GET', '/x')
            await server.close()
            throw new Error(text)
        }],
        ['invalid-status-code', async () => {
            const server = await serve((app) => {
                app.get('/x', asyncValidatorHandler(async () => { throw new ApiError('x', 9999) }))
                // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs all four parameters
                app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
                    res.status(500).json({ error: `${err.name}: ${err.message}` })
                })
            })
            const { json } = await server.request('GET', '/x')
            await server.close()
            throw new Error((json as { error: string }).error)
        }]
    ]

    it.each(reproductions)('%s', async (id, run) => {
        const text = await failure(run)
        expect(matchKnownErrors(text, ALL).map((known) => known.id), text).toContain(id)
    })

    it.each([
        ['missing-key-env', 'Error: JWE public key is not found in environment variables.'],
        ['pem-literal-newlines', 'DOMException [InvalidCharacterError]: Invalid character'],
        ['pem-literal-newlines', 'SyntaxError: Found a character that cannot be part of a valid base64 string.'],
        ['alg-not-supported', 'JOSENotSupported [ERR_JOSE_NOT_SUPPORTED]: alg none is not supported either by JOSE or your javascript runtime'],
        ['peer-dependency-missing', `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'uuid' imported from /app/node_modules/@qnx/crypto/dist/crypto.mjs`],
        ['zod-peer-conflict', 'npm error code ERESOLVE\nnpm error Could not resolve dependency:\nnpm error peer zod@"4.x" from @qnx/response@0.8.15'],
        ['qnx-errors-too-old', `SyntaxError: The requested module '@qnx/errors' does not provide an export named 'ApiError'`],
        ['handler-returned-nothing', '<pre>Cannot DELETE /items/1</pre>'],
        ['request-body-empty', '{"errors":{"":["Invalid input: expected object, received undefined"]},"error":"Invalid input: expected object, received undefined"}'],
        ['server-error-in-response', '{"serverError":{"name":"Error","message":"x","stack":"Error: x"}}'],
        ['error-logged-as-empty-object', '{"error":{},"level":"error","message":"Something went wrong"}'],
        ['logs-directory-failure', `Error: EEXIST: file already exists, mkdir 'logs'`],
        ['logs-directory-failure', `Error: EROFS: read-only file system, mkdir 'logs'`],
        ['ts-env-string-undefined', `t.ts(12,36): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`],
        ['interfaces-request-type', `a.ts(5,41): error TS2344: Type 'AuthRequest' does not satisfy the constraint 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>'.`],
        ['ts-jwe-options', `error TS2345: Argument of type '{ enc: string; }' is not assignable. Property 'alg' is missing in type '{ enc: string; }'`],
        ['headers-already-sent', 'Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client'],
        ['mcp-session-not-found', '{"error":"Session not found. The mcp-session-id header is present"}']
    ])('%s from a reported message', (id, text) => {
        expect(matchKnownErrors(text, ALL).map((known) => known.id)).toContain(id)
    })

    it('gives the install command for the package that is missing', async () => {
        const uuid = (await callTool('diagnose-error', { error: `Cannot find package 'uuid' imported from x` })).text
        const chalk = (await callTool('diagnose-error', { error: `Cannot find package 'chalk' imported from x` })).text
        expect(uuid).toContain('npm install @qnx/crypto jose uuid')
        expect(chalk).toContain('npm install @qnx/log chalk')
    })

    it.each([
        'ECONNREFUSED 127.0.0.1:5432',
        'TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["x-test"]',
        `Error: Cannot find module './routes/users'`,
        'SyntaxError: Unexpected token } in JSON at position 12',
        'TypeError: Cannot read properties of undefined (reading \'map\')',
        'MongoServerError: E11000 duplicate key error collection'
    ])('says it does not know %s, and doesn\'t guess', async (error) => {
        const { text, isError } = await callTool('diagnose-error', { error })
        expect(isError).toBe(false)
        expect(text).toContain('No known match')
        expect(text).not.toContain('**Cause:**')
    })

    it('stays within a scoped server', async () => {
        const text = 'JWT private key is not found in environment variables.'
        expect(matchKnownErrors(text, { crypto: true })).toHaveLength(1)
        expect(matchKnownErrors(text, { log: true })).toHaveLength(0)
    })

    it('every entry points to docs that exist', async () => {
        const { knownErrors } = await import('../knowledge/known-errors')
        for (const { id, docs } of knownErrors) {
            const call = docs && /^(\S+) (\{.*\})$/.exec(docs)
            if (!call) continue
            const { isError } = await callTool(call[1], JSON.parse(call[2]))
            expect(isError, id).toBe(false)
        }
    })
})

describe('tools stay fast on hostile input, since the endpoint is public', () => {
    const SIZE = 190_000
    const repeat = (text: string) => text.repeat(Math.ceil(SIZE / text.length)).slice(0, SIZE)

    it.each([
        '.query(', '.query(x(err,', 'res.status(500).json(', 'fetch(', 'jwtSign(', 'asyncValidatorHandler(', 'asyncValidatorHandler(async () => {',
        'logger.error(', 'logger.error(a,{', '.setError(', 'generateAuthToken(', 's=toSymmetricSecret(x);jwtSign({},s);', 'router.get(a,', '(', '{', '"', '\\', '/*'
    ])('%s repeated', async (unit) => {
        const code = repeat(unit)
        const started = performance.now()
        await callTool('review-code', { code })
        await callTool('transform-to-async-handler', { code })
        // Hit about 8 seconds before the scans were bounded. This limit is generous for slow CI.
        expect(performance.now() - started).toBeLessThan(2000)
    }, 20_000)
})

describe('search-docs answers real questions', () => {
    it.each([
        ['JWTExpired', 'get-crypto-docs'],
        ['ERR_JWE_DECRYPTION_FAILED', 'diagnose-error'],
        ['not found in environment', 'diagnose-error'],
        ['troubleshooting', 'get-crypto-docs'],
        ['openssl generate keys', 'get-crypto-docs { "topic": "setup" }'],
        ['session expiry', ''],
        ['setCallback', 'get-response-docs'],
        ['ExecuteFun', '@qnx/response'],
        ['stack trace reaches client', 'server-error'],
        ['why does my DELETE handler return 404', 'handler-return-values'],
        ['log an error with its stack', 'logging-errors'],
        ['change validation status code to 422', 'setErrorCodes'],
        ['Content-Type', ''],
        ['refresh token expired', ''],
        ['file rotation retention', 'get-file-logger-docs'],
        ['response.ok failure', 'handling-responses']
    ])('%s', async (query, expected) => {
        const { text } = await callTool('search-docs', { query })
        expect(text).toContain('## 1.')
        expect(text).toContain(expected)
    })

    it.each(['kubernetes helm chart', 'vue composable', 'react component'])('reports no match for %s, and says what does exist', async (query) => {
        const { text } = await callTool('search-docs', { query })
        // Either answer is right, as long as it says plainly that these don't exist.
        expect(text).toMatch(/no UI components/)
    })

    it.each([['asyncSubArrayGenerator', '@qnx/core-helpers'], ['requiredField', '@qnx/message'], ['req.user typed', '@qnx/interfaces']])('finds %s in %s', async (query, expected) => {
        expect((await callTool('search-docs', { query })).text.split('---')[0]).toContain(expected)
    })

    it('stays within a scoped server, and honours limit', async () => {
        const scoped = (await callTool('search-docs', { query: 'stack trace', limit: 3 }, { winston: true })).text
        expect(scoped).toContain('@qnx/winston')
        expect(scoped).not.toContain('@qnx/response\n')
        expect(scoped.match(/^## \d+\./gm)?.length).toBeLessThanOrEqual(3)
    })

    it('every knowledge term from the evaluation is now findable', async () => {
        const { text } = await callTool('get-crypto-docs', { topic: 'all' })
        for (const term of ['openssl', 'generateKeyPair', 'not found in environment', 'JWTExpired', 'JWSSignatureVerificationFailed', 'JWEDecryptionFailed', 'never expire', 'uuid']) {
            expect(text, term).toContain(term)
        }
    })
})

describe('review-code finds real mistakes without flagging correct code', () => {
    const rules = async (code: string, config?: Parameters<typeof callTool>[2]) =>
        ((await callTool('review-code', { code }, config)).json().findings as { rule: string }[]).map(({ rule }) => rule)

    it.each([
        ['handler-returns-nothing', `router.delete('/x', asyncValidatorHandler(async (req) => {\n    await Item.delete(req.params.id)\n}))`],
        ['plain-error-reaches-client', `router.get('/x', asyncValidatorHandler(async () => {\n    throw new Error('db password wrong')\n}))`],
        ['deprecated-response-helper', `throwInvalidValueApiResponse('a', 'b')`],
        ['route-without-async-handler', `import { asyncValidatorHandler } from '@qnx/response'\nrouter.get('/x', (req, res) => { res.json({}) })`],
        ['unauthenticated-message-not-sent', `throw new UnauthenticatedUserError('Session expired')`],
        ['set-error-replaces-others', `ApiResponseErrorsValue.getInstance().setError('a', '1').setError('b', '2')`],
        ['client-get-error-check', `if (res.getError()) { show() }`],
        ['client-missing-data-check', `if (!raw.data) { show() }`],
        ['fetch-without-content-type', `await fetch('/x', { method: 'POST', body: JSON.stringify(payload) })`],
        ['error-nested-in-log-metadata', `logger.error('Failed', { error: err })`],
        ['error-nested-in-log-metadata', `logger.error('Failed', { error })`],
        ['error-nested-in-log-metadata', `logger.error('Failed', { retries: 3, error: err })`],
        ['error-as-only-log-argument', `logger.error(err)`],
        ['silly-never-written', `logger.silly('x')`],
        ['symmetric-sign-without-alg', `const secret = toSymmetricSecret(env)\nawait jwtSign({}, secret)`],
        ['asymmetric-sign-without-alg', `const key = await toPKCS8Secret(pem, 'RS256')\nawait jwtSign({}, key)`],
        ['jwt-without-expiry', `await jwtSign({}, key)`],
        ['hardcoded-secret', `toSymmetricSecret('my-secret-string')`],
        ['auth-token-without-expiry', `const { token, dbToken } = await generateAuthToken(id)\nawait db.save(dbToken)`],
        ['console-log-error-message', 'consoleLog(`Failed: ${err.message}`, { type: \'error\' })']
    ])('%s', async (rule, code) => {
        expect(await rules(code)).toContain(rule)
    })

    it.each([
        ['a handler that returns', `router.delete('/x', asyncValidatorHandler(async () => {\n    await a()\n    return initializeApiResponse().setMessage('Deleted.')\n}))`],
        ['a handler that only throws', `router.get('/x', asyncValidatorHandler(async () => {\n    throw new ServerError('Safe')\n}))`],
        ['an expression-bodied handler', `router.get('/x', asyncValidatorHandler(async () => items))`],
        ['a handler that uses res', `router.get('/x', asyncValidatorHandler(async (req, res) => {\n    res.redirect('/y')\n}))`],
        ['a generic unauthenticated message', `throw new UnauthenticatedUserError('Unauthenticated')`],
        ['addError', `ApiResponseErrorsValue.getInstance().addError('a', '1').addError('b', '2')`],
        ['a response.ok check', `if (!response.ok) show(res.getError() ?? res.getMessage())`],
        ['fetch with headers', `await fetch('/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })`],
        ['logging an Error correctly', `logger.error('Failed', err)`],
        ['metadata without an error', `logger.error('Failed', { retries: 3 })`],
        ['symmetric signing with alg', `const secret = toSymmetricSecret(env)\nawait jwtSign({}, secret, { alg: 'HS256', expirationTime: '2h' })`],
        ['asymmetric signing with alg', `const key = await toPKCS8Secret(pem, 'RS256')\nawait jwtSign({}, key, { alg: 'RS256', expirationTime: '2h' })`],
        ['default ES256 signing', `const key = await toPKCS8Secret(pem, 'ES256')\nawait jwtSign({}, key, { expirationTime: '2h' })`],
        ['a secret from the environment', `toSymmetricSecret(process.env.SECRET ?? '')`],
        ['an auth token with a session expiry', `const { dbToken } = await generateAuthToken(id)\nawait db.save({ dbToken, expiresAt })`],
        ['logging the Error itself', `consoleLog(err, { type: 'error' })`],
        ['a mistake mentioned only in a comment', `// never do: logger.error('Failed', { error: err })\n/* if (res.getError()) {} */`],
        ['a mistake mentioned only in a string', `const help = "logger.error('Failed', { error: err })"`]
    ])('leaves %s alone', async (_name, code) => {
        expect(await rules(code)).toEqual([])
    })

    it('no guide or doc example the server recommends has a problem in its own review', async () => {
        const docs = [
            (await callTool('get-guide', { topic: 'crud-api' })).text,
            (await callTool('get-guide', { topic: 'auth-session' })).text,
            (await callTool('get-guide', { topic: 'server-and-client' })).text,
            (await callTool('get-client-docs', { topic: 'handling-responses' })).text
        ]
        for (const doc of docs) {
            for (const block of fencedBlocks(doc)) {
                const { findings } = (await callTool('review-code', { code: block })).json()
                expect(findings.filter(({ severity }: { severity: string }) => severity !== 'info'), block.slice(0, 60)).toEqual([])
            }
        }
    })

    it('reports the right line, and only checks packages in scope', async () => {
        const code = `const a = 1\n\nlogger.silly('x')`
        const { findings } = (await callTool('review-code', { code })).json()
        expect(findings[0]).toMatchObject({ line: 3, code: `logger.silly('x')`, severity: 'warning' })
        expect(await rules(code, { crypto: true })).toEqual([])
    })

    it('finds the mistakes in the evaluation\'s code, with its limits stated', async () => {
        const output = (await callTool('review-code', { code: `router.delete('/items/:id', asyncValidatorHandler(async (req) => {
    await Item.remove(req.params.id)
}))

const res = new ApiResponse(await (await fetch('/x')).json())
if (res.getError()) show()

try {
    await work()
} catch (err) {
    logger.error('Failed', { error: err })
}` })).json()
        expect(output.findings.map(({ rule }: { rule: string }) => rule)).toEqual(['handler-returns-nothing', 'client-get-error-check', 'error-nested-in-log-metadata'])
        expect(output.limits).toMatch(/Pattern matching/)
    })
})
