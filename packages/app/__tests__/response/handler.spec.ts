import request from 'supertest'
import app from '../../src/main'
import { setErrorCodes } from '../../src/main'

describe('Response Integration Testing', function () {
    it('Success Object', async function () {
        const response = await request(app).get('/object').set('Accept', 'application/json')
        expect(response.status).toEqual(200)
        expect({ message: 'Welcome to app!' }).toEqual(response.body.data)
    })

    it('Success String', async function () {
        const response = await request(app).get('/string').set('Accept', 'application/json')
        expect(response.status).toEqual(200)
        expect('this is string!').toEqual(response.body.data)
    })

    it('invalidValueApiResponse', async function () {
        const response = await request(app).get('/invalid-value').set('Accept', 'application/json')
        expect(response.status).toEqual(400)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('invalidApiResponse', async function () {
        const response = await request(app).get('/invalid-api').set('Accept', 'application/json')
        expect(response.status).toEqual(400)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.'],
                bar: ['Bar is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('ValidationErrorResponse', async function () {
        const response = await request(app)
            .get('/validation-error')
            .set('Accept', 'application/json')

        expect(response.status).toEqual(400)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.'],
                bar: ['Bar is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('InvalidValueValidationErrorResponse', async function () {
        const response = await request(app)
            .get('/invalid-value-validation-error')
            .set('Accept', 'application/json')

        expect(response.status).toEqual(400)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('throwInvalidValueApiResponse', async function () {
        const response = await request(app)
            .get('/throw-invalid-value-error')
            .set('Accept', 'application/json')
        expect(response.status).toEqual(400)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('ValidationErrorResponse With some fields', async function () {
        const response = await request(app)
            .post('/zod-validation-error')
            .send({ name: 'Foo' })
            .set('Accept', 'application/json')
        expect(response.status).toEqual(400)

        expect('Required').toEqual(response.body.error)
        expect({ errors: { email: ['Required'] }, error: 'Required' }).toEqual(response.body)
    })

    it('ValidationErrorResponse With a field', async function () {
        const response = await request(app)
            .post('/zod-validation-error')
            .send({ name: 'test' })
            .set('Accept', 'application/json')
        expect(response.status).toEqual(400)

        expect('Required').toEqual(response.body.error)
        expect({ errors: { email: ['Required'] }, error: 'Required' }).toEqual(response.body)
    })

    it('ValidationErrorResponse With All fields', async function () {
        const response = await request(app)
            .post('/zod-validation-error')
            .send({ name: 'Foo', email: 'foo@abc.com' })
            .set('Accept', 'application/json')
        expect(response.status).toEqual(200)

        expect('User created successfully.').toEqual(response.body.message)
        expect({
            data: { name: 'Foo', email: 'foo@abc.com' },
            message: 'User created successfully.'
        }).toEqual(response.body)
    })

    it('Unauthenticated', async function () {
        const response = await request(app)
            .get('/unauthenticated')
            .set('Accept', 'application/json')
        expect(response.status).toEqual(500)
    })

    it('generateErrorLog', async function () {
        const response = await request(app).get('/generate-log').set('Accept', 'application/json')
        expect(response.status).toEqual(200)

        expect('Logger testing.').toEqual(response.body.serverError.message)
    })
})

describe('Response Integration Testing With Change Codes', function () {
    it('Change codes', async function () {
        setErrorCodes({
            UNAUTHENTICATED_USER_ERROR_CODE: 200,
            SERVER_ERROR_CODE: 200,
            VALIDATION_ERROR_CODE: 200
        })
    })

    it('Success Object', async function () {
        const response = await request(app).get('/object').set('Accept', 'application/json')
        expect(response.status).toEqual(200)
        expect({ message: 'Welcome to app!' }).toEqual(response.body.data)
    })

    it('ValidationErrorResponse With a field', async function () {
        const response = await request(app)
            .post('/zod-validation-error')
            .send({ name: 'test' })
            .set('Accept', 'application/json')
        expect(response.status).toEqual(200)

        expect('Required').toEqual(response.body.error)
        expect({ errors: { email: ['Required'] }, error: 'Required' }).toEqual(response.body)
    })

    it('InvalidValueValidationErrorResponse', async function () {
        const response = await request(app)
            .get('/invalid-value-validation-error')
            .set('Accept', 'application/json')

        expect(response.status).toEqual(200)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('invalidValueApiResponse', async function () {
        const response = await request(app).get('/invalid-value').set('Accept', 'application/json')
        expect(response.status).toEqual(200)
        expect('Foo is required.').toEqual(response.body.error)
        expect({
            errors: {
                foo: ['Foo is required.']
            },
            error: 'Foo is required.'
        }).toEqual(response.body)
    })

    it('unauthenticateApiResponse', async function () {
        const response = await request(app)
            .get('/unauthenticated-error')
            .set('Accept', 'application/json')
        expect(response.status).toEqual(200)

        expect('unauthenticated').toEqual(response.body.errorCode)
        expect('Unauthenticated').toEqual(response.body.message)
    })

    it('generateErrorLog', async function () {
        const response = await request(app).get('/generate-log').set('Accept', 'application/json')
        expect(response.status).toEqual(200)

        expect('Logger testing.').toEqual(response.body.serverError.message)
    })
})
