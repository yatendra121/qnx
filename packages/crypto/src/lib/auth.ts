import { type KeyLike, importPKCS8, jwtVerify } from 'jose'
import { v4 as uuidv4 } from 'uuid'
import { jweDecrypt, jweEncrypt, jwtSign } from './crypto'

const spki = process.env['ENCRYPTION_SECRET_JWT']

const spki2 = process.env['ENCRYPTION_SECRET_JWE']

let ecJwtPrivateKey: KeyLike | Uint8Array
let ecJwePublicKey: KeyLike | Uint8Array

/**
 * Initiate crypto
 * @returns void
 */
const init = async () => {
    if (ecJwtPrivateKey && ecJwePublicKey) return

    if (!spki) throw new Error('JWT encryption secret is not found in env.')
    if (!spki2) throw new Error('JWE encryption secret is not found in env.')

    ecJwtPrivateKey = await importPKCS8(spki, 'ES256')
    ecJwePublicKey = await importPKCS8(spki2, 'ECDH-ES+A128KW')
}

init().then(() => console.log('@qnx/crypto initiated.'))

/**
 * Generates an authentication token.
 *
 * @param subject The subject of the token, typically representing the user.
 * @param key The private key or secret used for signing the JWT and encrypting the JWE.
 *            See {@link https://github.com/panva/jose/issues/210#jwe-alg Algorithm Key Requirements}.
 * @returns A promise resolving to an object containing the generated authentication token (JWE) and its corresponding database token (JWT ID).
 */
export const generateAuthToken = async (subject: string, key: KeyLike | Uint8Array) => {
    const jti = uuidv4()
    const jwt = await jwtSign({}, key, { jti, subject })
    const jwe = await jweEncrypt(jwt, ecJwePublicKey)

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
export const decyptAuthToken = async (jwe: string, key: KeyLike | Uint8Array) => {
    const { plaintext } = await jweDecrypt(jwe, ecJwePublicKey)
    const { payload } = await jwtVerify(plaintext, key)
    return payload
}

// /**
//  * This class useful for collect & set errors for api response errors
//  */
// export class JwtPrivateKey {
//     static key: KeyLike | Uint8Array | undefined
//     /**
//      * Set error
//      * @param errorKey
//      * @param errorMessage
//      * @returns
//      */
//     static async getKey(): Promise<KeyLike | Uint8Array> {
//         if (JwtPrivateKey.key) return JwtPrivateKey.key

//         const spki = process.env['ENCRYPTION_SECRET_JWT']

//         if (!spki) throw new Error('JWT encryption secret is not found in env.')

//         const ecJwtPrivateKey = await importPKCS8(spki, 'ES256')

//         JwtPrivateKey.key = ecJwtPrivateKey

//         return JwtPrivateKey.key
//     }
// }

// /**
//  * Encrypt JWT token
//  * @param jwe
//  * @returns string
//  */
// export const collectJWTSecret = async (encKey?: string): Promise<KeyLike | Uint8Array> => {
//     return encKey ? new TextEncoder().encode(encKey) : await JwtPrivateKey.getKey()
// }
