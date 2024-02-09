/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { ValidationError } from '@qnx/errors'
import {
    ApiResponseErrorsValue,
    asyncValidatorHandler,
    initializeApiResponse,
    invalidApiResponse,
    invalidValueApiResponse,
    throwInvalidValueApiResponse,
    unauthenticateApiResponse,
    setCallback,
    ApiResponse
} from '@qnx/response'
import { setErrorCodes } from '@qnx/errors'
import { logger } from '@qnx/winston'
import express, { urlencoded } from 'express'
import z from 'zod'
import * as path from 'path'
import { json } from 'body-parser'
import { InvalidValueError } from '@qnx/errors'

const app = express()

app.use('/assets', express.static(path.join(__dirname, 'assets')))
app.use(urlencoded({ extended: true }))
app.use(json())

setCallback({
    logger: {
        serverError: (error) => {
            logger.error('API Handler:', error)
        }
    }
})

app.get(
    '/',
    asyncValidatorHandler(async () => {
        return { message: 'Server is running!' }
    })
)

app.get(
    '/object',
    asyncValidatorHandler(async () => {
        return { message: 'Welcome to app!' }
    })
)

app.get(
    '/string',
    asyncValidatorHandler(async () => {
        return 'this is string!'
    })
)

app.get(
    '/additional-data',
    asyncValidatorHandler(async () => {
        return ApiResponse.getInstance().setAdditional({ data: { foo: 'additional' }, test: 'ok' })
    })
)

app.get(
    '/additional-data-with-data',
    asyncValidatorHandler(async () => {
        return ApiResponse.getInstance()
            .setData({ foo: 'bar' })
            .setAdditional({ data: { foo: 'additional' }, test: 'ok' })
    })
)

app.get(
    '/invalid-value',
    asyncValidatorHandler(async (req, res) => {
        const errorKey = 'foo'
        const errorMessage = 'Foo is required.'
        //@ts-ignore
        return invalidValueApiResponse(res, errorKey, errorMessage)
    })
)

app.get(
    '/invalid-api',
    asyncValidatorHandler(async (req, res) => {
        const errors = ApiResponseErrorsValue.getInstance()
            .addError('foo', 'Foo is required.')
            .addError('bar', 'Bar is required.')
            .getErrors()
        //@ts-ignore
        return invalidApiResponse(res, errors)
    })
)

app.get(
    '/validation-error',
    asyncValidatorHandler(() => {
        const errors = ApiResponseErrorsValue.getInstance()
            .addError('foo', 'Foo is required.')
            .addError('bar', 'Bar is required.')
            .getErrors()

        throw new ValidationError('Errors', { errRes: { errors } })
    })
)

app.get(
    '/invalid-value-validation-error',
    asyncValidatorHandler(async () => {
        throw new InvalidValueError('Foo is required.', { key: 'foo' })
    })
)

app.get(
    '/throw-invalid-value-error',
    asyncValidatorHandler(async () => {
        return throwInvalidValueApiResponse('foo', 'Foo is required.')
    })
)

app.post(
    '/zod-validation-error',
    asyncValidatorHandler(async (req) => {
        const UserSchema = z.object({
            name: z.string(),
            email: z.string()
        })

        const userData = UserSchema.parse(req.body)

        return initializeApiResponse().setData(userData).setMessage('User created successfully.')
    })
)

app.post(
    '/zod-validation-error/array',
    asyncValidatorHandler(async (req) => {
        const UserSchema = z.object({
            addresses: z.array(z.string()),
            posts: z.object({
                title: z.string(),
                tagUsers: z.array(z.string())
            })
        })

        const userData = UserSchema.parse(req.body)

        return initializeApiResponse().setData(userData).setMessage('User created successfully.')
    })
)

app.get(
    '/change-status-code',
    asyncValidatorHandler(async () => {
        return ApiResponse.getInstance().setStatusCode(400).setMessage('this is string!')
    })
)

app.get(
    '/unauthenticated',
    asyncValidatorHandler(async () => {
        return initializeApiResponse().setStatusCode(500)
    })
)

app.get(
    '/unauthenticated-error',
    asyncValidatorHandler(async (_req, res) => {
        //@ts-ignore
        return unauthenticateApiResponse(res)
    })
)

app.get(
    '/generate-log',
    asyncValidatorHandler(async () => {
        throw new Error('Logger testing.')
    })
)
//@ts-ignore
app.get('/check-invalid-function-value', asyncValidatorHandler(undefined))

const port = process.env.PORT || 3333
const server = app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}/`)
})
server.on('error', console.error)
export default app
export { setErrorCodes }
