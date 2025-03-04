import {
    compactDecrypt,
    SignJWT,
    CompactEncrypt,
    type CryptoKey,
    type KeyObject,
    type JWK,
    type JWTPayload,
    type SignOptions,
    type EncryptOptions,
    type DecryptOptions,
    type CompactJWEHeaderParameters
} from 'jose'

export { jwtVerify } from 'jose'

/**
 * Encrypts a value of the JWE string.
 *
 * @param plaintext string.
 * @param key Private Key or Secret to decrypt the JWE with. See
 *   {@link https://github.com/panva/jose/issues/210#jwe-alg Algorithm Key Requirements}.
 * @param options JWE Decryption options.
 */
export const jweEncrypt = (
    plaintext: string,
    key: CryptoKey | KeyObject | JWK | Uint8Array,
    options?: EncryptOptions & { alg: string; enc: string }
): Promise<string> => {
    return new CompactEncrypt(new TextEncoder().encode(plaintext))
        .setProtectedHeader({
            alg: options?.alg ?? 'ECDH-ES+A128KW',
            enc: options?.enc ?? 'A256CBC-HS512'
        })
        .encrypt(key, options)
}

/**
 * Decrypts a JWE.
 *
 * @param jwe JWE.
 * @param key Private Key or Secret to decrypt the JWE with. See
 *   {@link https://github.com/panva/jose/issues/210#jwe-alg Algorithm Key Requirements}.
 * @param options JWE Decryption options.
 */
export const jweDecrypt = async (
    jwe: string,
    key: CryptoKey | KeyObject | JWK | Uint8Array,
    options?: DecryptOptions
): Promise<{ plaintext: string; protectedHeader: CompactJWEHeaderParameters }> => {
    const { plaintext, protectedHeader } = await compactDecrypt(jwe, key, options)

    return { plaintext: new TextDecoder().decode(plaintext), protectedHeader }
}

/**
 * Signs and returns the JWT.
 *
 * @param payload — The JWT Claims Set object. Defaults to an empty object.
 * @param key Key to verify the JWT with. See
 *   {@link https://github.com/panva/jose/issues/210#jws-alg Algorithm Key Requirements}.
 * @param options JWT Sign options.
 */
export const jwtSign = (
    payload: JWTPayload,
    key: CryptoKey | KeyObject | JWK | Uint8Array,
    options?: SignOptions & {
        jti?: string
        issuer?: string
        expirationTime?: string | number | Date
        alg?: string
        subject?: string
    }
): Promise<string> => {
    let signJWT = new SignJWT(payload)
        .setProtectedHeader({ alg: options?.alg ?? 'ES256', typ: 'JWT' })
        .setIssuedAt()

    if (options?.jti) signJWT = signJWT.setJti(options.jti)
    if (options?.subject) signJWT = signJWT.setSubject(options.subject)
    if (options?.issuer) signJWT = signJWT.setIssuer(options.issuer)
    if (options?.expirationTime) signJWT = signJWT.setExpirationTime(options.expirationTime)

    return signJWT.sign(key, options)
}
