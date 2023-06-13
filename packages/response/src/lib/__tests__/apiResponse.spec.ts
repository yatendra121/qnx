import { describe, test, expect, vi } from 'vitest'
import { initializeApiResponse, ApiResponse } from '../apiResponse'

const responseMock = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
}

describe('ApiResponse Tests', () => {
    test('should set data correctly', () => {
        const apiResponse = initializeApiResponse()
        const data = { foo: 'bar' }

        apiResponse.setData(data)
        expect(apiResponse.response(responseMock)).toMatchObject({ data })
    })

    test('should set error code correctly', () => {
        const apiResponse = initializeApiResponse()
        const errorCode = 'INVALID_REQUEST'

        apiResponse.setErrorCode(errorCode)
        expect(apiResponse.response(responseMock)).toMatchObject({ errorCode })
    })

    test('should set error message correctly', () => {
        const apiResponse = initializeApiResponse()
        const errorMessage = 'An error occurred.'

        apiResponse.setError(errorMessage)
        expect(apiResponse.response(responseMock)).toMatchObject({ error: errorMessage })
    })

    test('should set multiple errors correctly', () => {
        const apiResponse = initializeApiResponse()
        const errors = { field1: ['Error 1', 'Error 2'], field2: ['Error 3'] }

        apiResponse.setErrors(errors)
        expect(apiResponse.response(responseMock)).toMatchObject({ errors })
    })

    test('should set message correctly', () => {
        const apiResponse = initializeApiResponse()
        const message = 'Request processed successfully.'

        apiResponse.setMessage(message)
        expect(apiResponse.response(responseMock)).toMatchObject({ message })
    })

    test('should set server error correctly', () => {
        const apiResponse = initializeApiResponse()
        const error = new Error('Internal server error')

        apiResponse.setServerError(error)
        expect(apiResponse.response(responseMock)).toMatchObject({
            serverError: expect.objectContaining({
                name: error.name,
                message: error.message,
                stack: error.stack
            })
        })
    })

    test('should not include serverError when SHOW_SERVER_ERROR is false', () => {
        const originalShowServerError = ApiResponse.SHOW_SERVER_ERROR
        ApiResponse.SHOW_SERVER_ERROR = false

        const apiResponse = initializeApiResponse()
        const error = new Error('Internal server error')

        apiResponse.setServerError(error)
        expect(apiResponse.response(responseMock)).not.toHaveProperty('serverError')

        ApiResponse.SHOW_SERVER_ERROR = originalShowServerError
    })

    test('should return the response with the specified status code', () => {
        const apiResponse = initializeApiResponse()
        const statusCode = 500

        apiResponse.response(responseMock, statusCode)
        expect(responseMock.status).toHaveBeenCalledWith(statusCode)
        expect(responseMock.send).toHaveBeenCalled()
    })

    test('should return the response with the default status code if not provided', () => {
        const apiResponse = initializeApiResponse()

        apiResponse.response(responseMock)
        expect(responseMock.status).toHaveBeenCalledWith(200)
        expect(responseMock.send).toHaveBeenCalled()
    })
})
