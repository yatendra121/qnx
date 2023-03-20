import { importPKCS8, compactDecrypt, KeyLike, SignJWT, CompactEncrypt, jwtVerify } from 'jose'
import { v4 as uuidv4 } from 'uuid'

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

init()

/**
 * Generate Token that used for authentication
 * @param subject
 * @returns token
 */
export const generateToken = async (subject: string) => {
    const jti = uuidv4()
    const jwt = await new SignJWT({})
        .setProtectedHeader({ typ: 'JWT', alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .setIssuer('https://mysite.com')
        .setSubject(subject)
        .setJti(jti)
        .sign(ecJwtPrivateKey)

    const jwe = await new CompactEncrypt(new TextEncoder().encode(jwt))
        .setProtectedHeader({ alg: 'ECDH-ES+A128KW', enc: 'A256CBC-HS512' })
        .encrypt(ecJwePublicKey)

    return { token: jwe, dbToken: jti }
}

/**
 * Decrypt Jwe token
 * @param jwe
 * @returns Promise
 */
export const decyptToken = async (jwe: string) => {
    try {
        const { plaintext } = await compactDecrypt(jwe, ecJwePublicKey)

        const jwt = new TextDecoder().decode(plaintext)

        const { payload } = await jwtVerify(jwt, ecJwtPrivateKey, {
            issuer: 'https://mysite.com'
        })

        return payload
    } catch (e) {
        throw new Error('Token decode error')
    }
}
