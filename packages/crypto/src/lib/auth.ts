import { type CryptoKey, type KeyObject, type JWK, importSPKI, jwtVerify, importPKCS8 } from 'jose'
import { v4 as uuidv4 } from 'uuid'
import { jweDecrypt, jweEncrypt, jwtSign } from './crypto'

// const spki = process.env['ENCRYPTION_SECRET_JWT']

// const spki2 = process.env['ENCRYPTION_SECRET_JWE']

// let ecJwtPrivateKey: KeyLike | Uint8Array
// let ecJwePublicKey: KeyLike | Uint8Array

/**
 * Initiate crypto
 * @returns void
 */
// const init = async () => {
//     if (ecJwtPrivateKey && ecJwePublicKey) return

//     if (!spki) throw new Error('JWT encryption secret is not found in env.')
//     if (!spki2) throw new Error('JWE encryption secret is not found in env.')

//     ecJwtPrivateKey = await importPKCS8(spki, 'ES256')
//     ecJwePublicKey = await importPKCS8(spki2, 'ECDH-ES+A128KW')
// }

//init().then(() => console.log('@qnx/crypto initiated.'))

/**
 * KeyPair class represents a pair of cryptographic keys for JWT and JWE encryption.
 */
class KeyPair {
    static jwtPublicKey: CryptoKey | KeyObject | JWK | Uint8Array
    static jwtPrivateKey: CryptoKey | KeyObject | JWK | Uint8Array
    static jwePublicKey: CryptoKey | KeyObject | JWK | Uint8Array
    static jwePrivateKey: CryptoKey | KeyObject | JWK | Uint8Array

    /**
     * Retrieves the JWT public key.
     * If the key is already available, returns it; otherwise, loads it from environment variables.
     * @returns The JWT public key.
     * @throws Error if the JWT public key is not found in the environment variables.
     */
    static async getJwtPublicKey(): Promise<CryptoKey | KeyObject | JWK | Uint8Array> {
        if (KeyPair.jwtPublicKey) return KeyPair.jwtPublicKey

        const spkiJwt = process.env['JWT_PUBLIC_KEY']
        if (!spkiJwt) throw new Error('JWT public key is not found in environment variables.')

        return (KeyPair.jwtPublicKey = await importSPKI(spkiJwt, 'ES256'))
    }

    /**
     * Retrieves the JWE public key.
     * If the key is already available, returns it; otherwise, loads it from environment variables.
     * @returns The JWE public key.
     * @throws Error if the JWE public key is not found in the environment variables.
     */
    static async getJwePublicKey(): Promise<CryptoKey | KeyObject | JWK | Uint8Array> {
        if (KeyPair.jwePublicKey) return KeyPair.jwePublicKey

        const spkiJwe = process.env['JWE_PUBLIC_KEY']
        if (!spkiJwe) throw new Error('JWE public key is not found in environment variables.')

        return (KeyPair.jwePublicKey = await importSPKI(spkiJwe, 'ECDH-ES+A128KW'))
    }

    /**
     * Retrieves the JWT private key.
     * If the key is already available, returns it; otherwise, loads it from environment variables.
     * @returns The JWT private key.
     * @throws Error if the JWT private key is not found in the environment variables.
     */
    static async getJwtPrivateKey(): Promise<CryptoKey | KeyObject | JWK | Uint8Array> {
        if (KeyPair.jwtPrivateKey) return KeyPair.jwtPrivateKey

        const pkcs8Jwt = process.env['JWT_PRIVATE_KEY']
        if (!pkcs8Jwt) throw new Error('JWT private key is not found in environment variables.')

        return (KeyPair.jwtPrivateKey = await importPKCS8(pkcs8Jwt, 'ES256'))
    }

    /**
     * Retrieves the JWE private key.
     * If the key is already available, returns it; otherwise, loads it from environment variables.
     * @returns The JWE private key.
     * @throws Error if the JWE private key is not found in the environment variables.
     */
    static async getJwePrivateKey(): Promise<CryptoKey | KeyObject | JWK | Uint8Array> {
        if (KeyPair.jwePrivateKey) return KeyPair.jwePrivateKey

        const pkcs8Jwe = process.env['JWE_PRIVATE_KEY']
        if (!pkcs8Jwe) throw new Error('JWE private key is not found in environment variables.')

        return (KeyPair.jwePrivateKey = await importPKCS8(pkcs8Jwe, 'ECDH-ES+A128KW'))
    }
}

/**
 * Generates an authentication token.
 *
 * @param subject The subject of the token, typically representing the user.
 * @param key The private key or secret used for signing the JWT and encrypting the JWE.
 *            See {@link https://github.com/panva/jose/issues/210#jwe-alg Algorithm Key Requirements}.
 * @returns A promise resolving to an object containing the generated authentication token (JWE) and its corresponding database token (JWT ID).
 */
export const generateAuthToken = async (subject: string) => {
    const jti = uuidv4()
    const [jwtKey, jweKey] = await Promise.all([
        KeyPair.getJwtPrivateKey(),
        KeyPair.getJwePublicKey()
    ])

    const jwt = await jwtSign({}, jwtKey, { jti, subject })
    const jwe = await jweEncrypt(jwt, jweKey)

    return { token: jwe, dbToken: jti }
}

/**
 * Decrypts an authentication token (JWE) and verifies its integrity.
 *
 * @param jwe The authentication token (JWE) to decrypt.
 * @param key The private key or secret to decrypt the JWE and verify the JWT payload.
 *            See {@link https://github.com/panva/jose/issues/210#jwe-alg Algorithm Key Requirements}.
 * @returns A promise resolving to the payload of the decrypted and verified authentication token.
 */
export const decyptAuthToken = async (jwe: string) => {
    const [jwtKey, jweKey] = await Promise.all([
        KeyPair.getJwtPublicKey(),
        KeyPair.getJwePrivateKey()
    ])
    const { plaintext } = await jweDecrypt(jwe, jweKey)
    const { payload } = await jwtVerify(plaintext, jwtKey)
    return payload
}

// /**
//  * Encrypt JWT token
//  * @param jwe
//  * @returns string
//  */
// export const collectJWTSecret = async (encKey?: string): Promise<KeyLike | Uint8Array> => {
//     return encKey ? new TextEncoder().encode(encKey) : await JwtPrivateKey.getKey()
// }
