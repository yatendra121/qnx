import { type KeyLike, importPKCS8, jwtVerify } from 'jose'
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
    static jwtKey: KeyLike | Uint8Array | undefined
    static jweKey: KeyLike | Uint8Array | undefined

    /**
     * Retrieves the JWT encryption key.
     * If the key is already available, returns it; otherwise, fetches it from the environment variables.
     * @returns The JWT encryption key.
     * @throws Error if the JWT encryption secret is not found in the environment variables.
     */
    static async getJwtKey(): Promise<KeyLike | Uint8Array> {
        if (KeyPair.jwtKey) return KeyPair.jwtKey

        const spkiJwt = process.env['ENCRYPTION_SECRET_JWT']
        if (!spkiJwt) throw new Error('JWT encryption secret is not found in env.')

        return (KeyPair.jwtKey = await importPKCS8(spkiJwt, 'ES256'))
    }

    /**
     * Retrieves the JWE encryption key.
     * If the key is already available, returns it; otherwise, fetches it from the environment variables.
     * @returns The JWE encryption key.
     * @throws Error if the JWE encryption secret is not found in the environment variables.
     */
    static async getJweKey(): Promise<KeyLike | Uint8Array> {
        if (KeyPair.jweKey) return KeyPair.jweKey

        const spkiJwe = process.env['ENCRYPTION_SECRET_JWE']
        if (!spkiJwe) throw new Error('JWE encryption secret is not found in env.')

        return (KeyPair.jweKey = await importPKCS8(spkiJwe, 'ECDH-ES+A128KW'))
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
    const [jwtKey, jweKey] = await Promise.all([KeyPair.getJwtKey(), KeyPair.getJweKey()])

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
    const [jwtKey, jweKey] = await Promise.all([KeyPair.getJwtKey(), KeyPair.getJweKey()])
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
