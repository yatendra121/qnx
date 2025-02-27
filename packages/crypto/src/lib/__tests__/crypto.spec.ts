import { describe, it } from 'vitest'
import { jweEncrypt, jweDecrypt, jwtSign, jwtVerify } from '../crypto'
import { toSymmetricSecret } from '../key'
import { generateAuthToken, decyptAuthToken } from '../auth'
import { importPKCS8, importSPKI } from 'jose'

describe('Crypto Integration Testing', function () {
    it('generate token', async function () {
        const data = await generateAuthToken('string')

        expect(true).toEqual(!!data.dbToken)
        expect(true).toEqual(!!data.token)
    })

    it('generate & decrypt token', async function () {
        const tokenVal = 'this is testing string'
        const data = await generateAuthToken(tokenVal)
        expect(true).toEqual(!!data.dbToken)
        expect(true).toEqual(!!data.token)

        console.log({ data })

        const values = await decyptAuthToken(data.token)
        console.log({ values })

        expect(tokenVal).toEqual(values.sub)
    })
})

describe('Crypto Functions Testing', function () {
    it('Sign JWT & verify JWT using symmetric secret', async function () {
        const dataVal = {
            foo: 'bar'
        }
        const jwt = await jwtSign({ data: dataVal }, toSymmetricSecret('xyz'), {
            issuer: 'https:yatendra.tech',
            alg: 'HS256'
        })

        const { payload } = await jwtVerify(jwt, toSymmetricSecret('xyz'))
        expect(dataVal).toEqual(payload.data)
    })

    it('Sign JWT & verify JWT using asymmetric secret', async function () {
        const dataVal = {
            foo: 'bar'
        }

        const ecPrivateKey = await importPKCS8(process.env['JWT_PRIVATE_KEY'] ?? '', 'ES256')
        const jwt = await jwtSign({ data: dataVal }, ecPrivateKey, {
            issuer: 'https:yatendra.tech'
        })

        const ecPublicKey = await importSPKI(process.env['JWT_PUBLIC_KEY'] ?? '', 'ES256')
        const { payload } = await jwtVerify(jwt, ecPublicKey)
        expect(dataVal).toEqual(payload.data)
    })

    it('Encrypt JWE & descrypt JWE using PKCS8 secret', async function () {
        const ecPublicKey = await importSPKI(process.env['JWE_PUBLIC_KEY'] ?? '', 'ECDH-ES+A128KW')
        const dataVal = 'this is message.'
        const jwe = await jweEncrypt(dataVal, ecPublicKey)

        const ecPrivateKey = await importPKCS8(
            process.env['JWE_PRIVATE_KEY'] ?? '',
            'ECDH-ES+A128KW'
        )
        const { plaintext } = await jweDecrypt(jwe, ecPrivateKey)
        expect(dataVal).toEqual(plaintext)
    })
})
