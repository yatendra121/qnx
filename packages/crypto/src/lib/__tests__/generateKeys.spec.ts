import { createPrivateKey, createPublicKey } from 'node:crypto'
import { parseEnv } from 'node:util'
import { calculateJwkThumbprint } from 'jose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
    authTokenEncryptionAlgorithms,
    authTokenSigningAlgorithms,
    formatAuthKeyEnv,
    generateAuthKeys,
    type GeneratedAuthKeys
} from '../generateKeys'

const keyNames = ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'JWE_PRIVATE_KEY', 'JWE_PUBLIC_KEY'] as const
const names = ['JWT_ALG', ...keyNames, 'JWE_ALG'] as const

describe('generateAuthKeys', () => {
    let keys: GeneratedAuthKeys
    beforeAll(async () => {
        keys = await generateAuthKeys()
    })

    it('returns standard PEM keys on P-256 that Node and OpenSSL can read', () => {
        for (const name of keyNames) {
            const pem = keys.env[name]
            const key = name.endsWith('PRIVATE_KEY') ? createPrivateKey(pem) : createPublicKey(pem)
            expect(key.asymmetricKeyType, name).toBe('ec')
            expect(key.asymmetricKeyDetails?.namedCurve, name).toBe('prime256v1')
        }
        expect(keys.env.JWT_PRIVATE_KEY).toMatch(/^-----BEGIN PRIVATE KEY-----\n/)
        expect(keys.env.JWT_PUBLIC_KEY).toMatch(/^-----BEGIN PUBLIC KEY-----\n/)
    })

    it('pairs each public key with its private key, and uses different keys for JWT and JWE', () => {
        const x = (pem: string) => createPublicKey(pem).export({ format: 'jwk' }).x
        expect(x(keys.env.JWT_PRIVATE_KEY)).toBe(x(keys.env.JWT_PUBLIC_KEY))
        expect(x(keys.env.JWE_PRIVATE_KEY)).toBe(x(keys.env.JWE_PUBLIC_KEY))
        expect(x(keys.env.JWT_PUBLIC_KEY)).not.toBe(x(keys.env.JWE_PUBLIC_KEY))
    })

    it('returns new keys each time', async () => {
        const other = await generateAuthKeys()
        for (const name of keyNames) expect(other.env[name]).not.toBe(keys.env[name])
    })

    it('puts only the public keys in the JWKS, with kid, use and alg', async () => {
        const [sig, enc] = keys.jwks.keys
        expect(keys.jwks.keys).toHaveLength(2)
        expect(sig).toMatchObject({ kty: 'EC', crv: 'P-256', use: 'sig', alg: 'ES256' })
        expect(enc).toMatchObject({ kty: 'EC', crv: 'P-256', use: 'enc', alg: 'ECDH-ES+A128KW' })
        for (const jwk of keys.jwks.keys) {
            expect(jwk).not.toHaveProperty('d')
            expect(jwk.kid).toBe(await calculateJwkThumbprint(jwk))
        }
        expect(sig.x).toBe(createPublicKey(keys.env.JWT_PUBLIC_KEY).export({ format: 'jwk' }).x)
        expect(enc.x).toBe(createPublicKey(keys.env.JWE_PUBLIC_KEY).export({ format: 'jwk' }).x)
    })
})

describe('formatAuthKeyEnv', () => {
    it('writes lines that node --env-file reads back to the same keys', async () => {
        const { env } = await generateAuthKeys()
        const text = formatAuthKeyEnv(env)

        const parsed = parseEnv(text)
        for (const name of names) expect(parsed[name], name).toBe(env[name].trim())
        expect(Object.keys(parsed).sort()).toEqual([...names].sort())
        expect(text.endsWith('\n')).toBe(true)
    })
})

describe('generateAuthKeys options', () => {
    it('defaults to ES256 and ECDH-ES+A128KW, the values the auth functions assumed before', async () => {
        const { env } = await generateAuthKeys()
        expect([env.JWT_ALG, env.JWE_ALG]).toEqual(['ES256', 'ECDH-ES+A128KW'])
    })

    it.each([
        ['EdDSA', 'ed25519', undefined],
        ['ES384', 'ec', 'secp384r1'],
        ['ES512', 'ec', 'secp521r1']
    ] as const)('makes %s signing keys', async (jwtAlg, type, curve) => {
        const { env, jwks } = await generateAuthKeys({ jwtAlg })
        const key = createPublicKey(env.JWT_PUBLIC_KEY)
        expect(env.JWT_ALG).toBe(jwtAlg)
        expect(key.asymmetricKeyType).toBe(type)
        expect(key.asymmetricKeyDetails?.namedCurve).toBe(curve)
        expect(jwks.keys[0].alg).toBe(jwtAlg)
    })

    it('makes ECDH-ES+A256KW encryption keys on P-256', async () => {
        const { env, jwks } = await generateAuthKeys({ jweAlg: 'ECDH-ES+A256KW' })
        expect(env.JWE_ALG).toBe('ECDH-ES+A256KW')
        expect(createPublicKey(env.JWE_PUBLIC_KEY).asymmetricKeyDetails?.namedCurve).toBe(
            'prime256v1'
        )
        expect(jwks.keys[1].alg).toBe('ECDH-ES+A256KW')
    })

    it.each([
        [{ jwtAlg: 'RS256' }, 'jwtAlg must be one of ES256, ES384, ES512, EdDSA, not "RS256".'],
        [{ jweAlg: 'dir' }, 'jweAlg must be one of ECDH-ES+A128KW, ECDH-ES+A256KW, not "dir".']
    ])('rejects %j', async (options, message) => {
        await expect(generateAuthKeys(options as never)).rejects.toThrow(message)
    })
})

describe('keys from generateAuthKeys with the auth functions', () => {
    const saved: Record<string, string | undefined> = {}
    afterAll(() => {
        for (const [name, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[name]
            else process.env[name] = value
        }
        vi.resetModules()
    })

    async function loadAuthWith(text: string) {
        const parsed = parseEnv(text)
        for (const name of names) {
            if (!(name in saved)) saved[name] = process.env[name]
            if (parsed[name] === undefined) delete process.env[name]
            else process.env[name] = parsed[name]
        }
        // auth.ts caches keys on first use, so load a fresh copy that reads these.
        vi.resetModules()
        return import('../auth')
    }

    const pairs = authTokenSigningAlgorithms.flatMap((jwtAlg) =>
        authTokenEncryptionAlgorithms.map((jweAlg) => [jwtAlg, jweAlg] as const)
    )
    it.each(pairs)(
        'create and read a token with %s and %s, after a round trip through .env',
        async (jwtAlg, jweAlg) => {
            const { env } = await generateAuthKeys({ jwtAlg, jweAlg })
            const { generateAuthToken, decryptAuthToken } = await loadAuthWith(
                formatAuthKeyEnv(env)
            )

            const { token, dbToken } = await generateAuthToken('user-42')
            const payload = await decryptAuthToken(token)

            expect(payload.sub).toBe('user-42')
            expect(payload.jti).toBe(dbToken)
            const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
            expect(header.alg).toBe(jweAlg)
        }
    )

    it('still works with only the four keys in .env, as before JWT_ALG and JWE_ALG existed', async () => {
        const { env } = await generateAuthKeys()
        const text = formatAuthKeyEnv(env)
            .split('\n')
            .filter((line) => !line.startsWith('JWT_ALG=') && !line.startsWith('JWE_ALG='))
            .join('\n')
        const { generateAuthToken, decryptAuthToken } = await loadAuthWith(text)

        expect((await decryptAuthToken((await generateAuthToken('old')).token)).sub).toBe('old')
    })

    it('rejects a token encrypted with a different algorithm than JWE_ALG', async () => {
        const { env } = await generateAuthKeys({ jweAlg: 'ECDH-ES+A256KW' })
        const signer = await loadAuthWith(formatAuthKeyEnv(env))
        const { token } = await signer.generateAuthToken('user')

        const reader = await loadAuthWith(formatAuthKeyEnv({ ...env, JWE_ALG: 'ECDH-ES+A128KW' }))

        await expect(reader.decryptAuthToken(token)).rejects.toThrow()
    })
})
