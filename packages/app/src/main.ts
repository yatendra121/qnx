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
    unauthenticateApiResponse
} from '@qnx/response'
import { setErrorCodes } from '@qnx/errors'
import express, { urlencoded } from 'express'
import z from 'zod'
import * as path from 'path'
import { json } from 'body-parser'

const app = express()

app.use('/assets', express.static(path.join(__dirname, 'assets')))
app.use(urlencoded({ extended: true }))
app.use(json())

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
    '/invalid-value',
    asyncValidatorHandler(async (req, res) => {
        const errorKey = 'foo'
        const errorMessage = 'Foo is required.'
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

        return invalidApiResponse(res, errors)
    })
)

app.get(
    '/validation-error',
    asyncValidatorHandler(async () => {
        const errors = ApiResponseErrorsValue.getInstance()
            .addError('foo', 'Foo is required.')
            .addError('bar', 'Bar is required.')
            .getErrors()

        throw new ValidationError('Errors', { errors })
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

app.get(
    '/unauthenticated',
    asyncValidatorHandler(async () => {
        return initializeApiResponse().setStatusCode(500)
    })
)

app.get(
    '/unauthenticated-error',
    asyncValidatorHandler(async (_req, res) => {
        return unauthenticateApiResponse(res)
    })
)

const port = process.env.PORT || 3333
const server = app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}/api`)
})
server.on('error', console.error)
export default app
setErrorCodes({ UNAUTHENTICATED_USER_ERROR_CODE: 200, SERVER_ERROR_CODE: 200 })
export { setErrorCodes }
