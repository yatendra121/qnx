import { describe, it } from 'vitest'
import { jweEncrypt, jweDecrypt, jwtSign, jwtVerify } from '../crypto'
import { toPKCS8Secret, toSymmetricSecret } from '../key'
import { generateAuthToken, decyptAuthToken } from '../auth'

describe('Crypto Integration Testing', function () {
    it('generate token', async function () {
        const secret = await toPKCS8Secret(process.env['ENCRYPTION_SECRET_JWT'] ?? '', 'ES256')

        const data = await generateAuthToken('string', secret)

        expect(true).toEqual(!!data.dbToken)
        expect(true).toEqual(!!data.token)
    })

    it('generate & decrypt token', async function () {
        const secret = await toPKCS8Secret(process.env['ENCRYPTION_SECRET_JWT'] ?? '', 'ES256')

        const tokenVal = 'this is testing string'
        const data = await generateAuthToken(tokenVal, secret)
        expect(true).toEqual(!!data.dbToken)
        expect(true).toEqual(!!data.token)

        const values = await decyptAuthToken(data.token, secret)

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

        const secret = await toPKCS8Secret(process.env['ENCRYPTION_SECRET_JWT'] ?? '', 'ES256')
        const jwt = await jwtSign({ data: dataVal }, secret, {
            issuer: 'https:yatendra.tech'
        })

        const { payload } = await jwtVerify(jwt, secret)
        expect(dataVal).toEqual(payload.data)
    })

    it('Encrypt JWE & descrypt JWE using PKCS8 secret', async function () {
        const secret = await toPKCS8Secret(
            process.env['ENCRYPTION_SECRET_JWE'] ?? '',
            'ECDH-ES+A128KW'
        )
        const dataVal = 'this is message.'
        const jwe = await jweEncrypt(dataVal, secret)
        const { plaintext } = await jweDecrypt(jwe, secret)
        expect(dataVal).toEqual(plaintext)
    })
})
