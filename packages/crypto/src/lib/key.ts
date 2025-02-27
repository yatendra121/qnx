import { importJWK, importPKCS8, importSPKI } from 'jose'

/**
Encodes a given key string into a symmetric secret representation.
@param key The input key string to be encoded.
@returns Uint8Array A byte array representing the encoded symmetric secret.
*/
export const toSymmetricSecret = (key: string): Uint8Array => {
    return new TextEncoder().encode(key)
}

export { importPKCS8 as toPKCS8Secret, importSPKI as toSPKISecret, importJWK as toJWKSecret }
