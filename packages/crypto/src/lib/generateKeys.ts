import {
    calculateJwkThumbprint,
    exportJWK,
    exportPKCS8,
    exportSPKI,
    generateKeyPair,
    type JWK
} from 'jose'

/**
 * Algorithms that can sign the JWT inside an auth token, recommended first. ES256 is the default:
 * widely supported, with small keys and signatures.
 */
export const authTokenSigningAlgorithms = ['ES256', 'ES384', 'ES512', 'EdDSA'] as const

/**
 * Algorithms that can encrypt an auth token, recommended first. Both use a P-256 key.
 * ECDH-ES+A128KW is the default.
 */
export const authTokenEncryptionAlgorithms = ['ECDH-ES+A128KW', 'ECDH-ES+A256KW'] as const

export type AuthTokenSigningAlgorithm = (typeof authTokenSigningAlgorithms)[number]
export type AuthTokenEncryptionAlgorithm = (typeof authTokenEncryptionAlgorithms)[number]

export interface GenerateAuthKeysOptions {
    /** Defaults to `ES256`. */
    jwtAlg?: AuthTokenSigningAlgorithm
    /** Defaults to `ECDH-ES+A128KW`. */
    jweAlg?: AuthTokenEncryptionAlgorithm
}

/** The environment variables that `generateAuthToken` and `decryptAuthToken` read. */
export interface AuthKeyEnv {
    /** The algorithm for the JWT keys. */
    JWT_ALG: AuthTokenSigningAlgorithm
    /** PKCS8 PEM. Signs the JWT inside the token. Keep it secret. */
    JWT_PRIVATE_KEY: string
    /** SPKI PEM. Verifies that JWT. */
    JWT_PUBLIC_KEY: string
    /** The algorithm for the JWE keys. */
    JWE_ALG: AuthTokenEncryptionAlgorithm
    /** PKCS8 PEM. Decrypts the token. Keep it secret. */
    JWE_PRIVATE_KEY: string
    /** SPKI PEM. Encrypts the token. */
    JWE_PUBLIC_KEY: string
}

/** A JSON Web Key Set (RFC 7517) holding public keys only, safe to publish. */
export interface PublicJwks {
    keys: JWK[]
}

export interface GeneratedAuthKeys {
    /** The algorithms and PEM keys, by the environment variable they belong in. */
    env: AuthKeyEnv
    /** The two public keys as a JWKS: the signing key (`use: "sig"`) and the encryption key (`use: "enc"`). */
    jwks: PublicJwks
}

async function publicJwk(key: CryptoKey, alg: string, use: 'sig' | 'enc'): Promise<JWK> {
    const jwk = await exportJWK(key)
    // A thumbprint (RFC 7638) identifies the key without a registry, and stays the same for the same key.
    return { kid: await calculateJwkThumbprint(jwk), use, alg, ...jwk }
}

function checkAlgorithm(name: string, value: string, allowed: readonly string[]) {
    if (!allowed.includes(value)) {
        throw new TypeError(`${name} must be one of ${allowed.join(', ')}, not "${value}".`)
    }
}

/**
 * Generates new key pairs for `generateAuthToken` and `decryptAuthToken`: one for signing the JWT
 * and another for encrypting it, so one leaked key can't do both jobs.
 *
 * @param options - The algorithms to use. Both default to the recommended ones.
 * @returns The algorithms and PEM keys, by environment variable, and the public keys as a JWKS.
 */
export async function generateAuthKeys(
    options: GenerateAuthKeysOptions = {}
): Promise<GeneratedAuthKeys> {
    const { jwtAlg = 'ES256', jweAlg = 'ECDH-ES+A128KW' } = options
    // Checked here because the CLI and JavaScript callers aren't held to the types.
    checkAlgorithm('jwtAlg', jwtAlg, authTokenSigningAlgorithms)
    checkAlgorithm('jweAlg', jweAlg, authTokenEncryptionAlgorithms)

    const [jwt, jwe] = await Promise.all([
        generateKeyPair(jwtAlg, { extractable: true }),
        generateKeyPair(jweAlg, { crv: 'P-256', extractable: true })
    ])

    const [jwtPrivate, jwtPublic, jwePrivate, jwePublic, sigJwk, encJwk] = await Promise.all([
        exportPKCS8(jwt.privateKey),
        exportSPKI(jwt.publicKey),
        exportPKCS8(jwe.privateKey),
        exportSPKI(jwe.publicKey),
        publicJwk(jwt.publicKey, jwtAlg, 'sig'),
        publicJwk(jwe.publicKey, jweAlg, 'enc')
    ])

    return {
        env: {
            JWT_ALG: jwtAlg,
            JWT_PRIVATE_KEY: jwtPrivate,
            JWT_PUBLIC_KEY: jwtPublic,
            JWE_ALG: jweAlg,
            JWE_PRIVATE_KEY: jwePrivate,
            JWE_PUBLIC_KEY: jwePublic
        },
        jwks: { keys: [sigJwk, encJwk] }
    }
}

/**
 * Formats keys as `.env` lines. Each value is in double quotes, and each PEM keeps its line breaks,
 * which dotenv, `node --env-file` and Vite read back unchanged.
 *
 * @param env - The keys from `generateAuthKeys`.
 * @returns The lines, ending with a newline.
 */
export function formatAuthKeyEnv(env: AuthKeyEnv): string {
    return (
        Object.entries(env)
            .map(([name, value]) => `${name}="${value.trim()}"`)
            .join('\n') + '\n'
    )
}
