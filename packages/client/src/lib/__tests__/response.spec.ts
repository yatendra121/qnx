import { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from '../response'
import { describe, expect, it } from 'vitest'

describe('ApiResponse', () => {
    it('constructor initializes response object', () => {
        const apiResponse = new ApiResponse()
        expect(apiResponse).toBeDefined()
        expect(apiResponse.getData()).toBeUndefined()
        expect(apiResponse.getErrorCode()).toBeUndefined()
        expect(apiResponse.getError()).toBeUndefined()
        expect(apiResponse.getErrors()).toBeUndefined()
        expect(apiResponse.getMessage()).toBeUndefined()
    })

    it('getData method returns correct data', () => {
        const data = 'test data'
        const apiResponse = new ApiResponse<string>({ data })
        expect(apiResponse.getData()).toEqual(data)
    })

    it('getErrorCode method returns correct error code', () => {
        const errorCode = 'test error code'
        const apiResponse = new ApiResponse({ errorCode })
        expect(apiResponse.getErrorCode()).toEqual(errorCode)
    })

    it('getError method returns correct error message', () => {
        const error = 'test error message'
        const apiResponse = new ApiResponse({ error })
        expect(apiResponse.getError()).toEqual(error)
    })

    it('getErrors method returns correct errors object', () => {
        const errors = { field1: ['error message 1'], field2: ['error message 2'] }
        const apiResponse = new ApiResponse({ errors })
        expect(apiResponse.getErrors()).toEqual(errors)
    })

    it('getMessage method returns correct message', () => {
        const message = 'test message'
        const apiResponse = new ApiResponse({ message })
        expect(apiResponse.getMessage()).toEqual(message)
    })

    it('getData method returns undefined when data is not defined', () => {
        const apiResponse = new ApiResponse()
        expect(apiResponse.getData()).toBeUndefined()
    })

    it('getErrorCode method returns undefined when errorCode is not defined', () => {
        const apiResponse = new ApiResponse()
        expect(apiResponse.getErrorCode()).toBeUndefined()
    })

    it('getError method returns undefined when error is not defined', () => {
        const apiResponse = new ApiResponse()
        expect(apiResponse.getError()).toBeUndefined()
    })

    it('getErrors method returns undefined when errors is not defined', () => {
        const apiResponse = new ApiResponse()
        expect(apiResponse.getErrors()).toBeUndefined()
    })

    it('getMessage method returns undefined when message is not defined', () => {
        const apiResponse = new ApiResponse()
        expect(apiResponse.getMessage()).toBeUndefined()
    })

    it('ApiResponse instance returns undefined when response object is not defined', () => {
        const apiResponse = new ApiResponse(undefined)
        expect(apiResponse.getData()).toBeUndefined()
        expect(apiResponse.getErrorCode()).toBeUndefined()
        expect(apiResponse.getError()).toBeUndefined()
        expect(apiResponse.getErrors()).toBeUndefined()
        expect(apiResponse.getMessage()).toBeUndefined()
    })
})

describe('ApiSuccessResponse', () => {
    describe('getData', () => {
        it('returns the data when it exists', () => {
            const apiSuccessResponse = new ApiSuccessResponse<number>({
                data: 42,
                message: 'Success'
            })
            expect(apiSuccessResponse.getData()).toEqual(42)
        })
    })

    it('returns the data when it exists, even with heavy data', () => {
        const heavyData: string[] = []

        // Generate a large amount of data
        for (let i = 0; i < 100000; i++) {
            heavyData.push(`Data item ${i}`)
        }

        const apiSuccessResponse = new ApiSuccessResponse<string[]>({
            data: heavyData,
            message: 'Success'
        })

        expect(apiSuccessResponse.getData()).toEqual(heavyData)
    })

    describe('getMessage', () => {
        it('returns the message when it exists', () => {
            const apiSuccessResponse = new ApiSuccessResponse<number>({
                data: 42,
                message: 'Success'
            })
            expect(apiSuccessResponse.getMessage()).toEqual('Success')
        })
    })
})

describe('ApiErrorResponse', () => {
    describe('getError', () => {
        it('returns the error message when it exists', () => {
            const response = {
                error: 'Something went wrong',
                errors: {}
            }
            const apiErrorResponse = new ApiErrorResponse(response)

            const result = apiErrorResponse.getError()

            expect(result).toEqual('Something went wrong')
        })

        it('returns undefined when the error message does not exist', () => {
            const response = {
                errors: {}
            }
            const apiErrorResponse = new ApiErrorResponse(response)

            const result = apiErrorResponse.getError()

            expect(result).toBeUndefined()
        })
    })

    describe('getErrors', () => {
        it('returns the error messages when they exist', () => {
            const response = {
                error: 'Something went wrong',
                errors: {
                    email: ['Email is required', 'Email format is invalid']
                }
            }
            const apiErrorResponse = new ApiErrorResponse(response)

            const result = apiErrorResponse.getErrors()

            expect(result).toEqual({
                email: ['Email is required', 'Email format is invalid']
            })
        })

        it('returns undefined when the error messages do not exist', () => {
            const response = {
                error: 'Something went wrong'
            }
            const apiErrorResponse = new ApiErrorResponse(response)

            const result = apiErrorResponse.getErrors()

            expect(result).toBeUndefined()
        })
    })

    describe('getErrorCode', () => {
        it('returns the error code when it exists', () => {
            const response = {
                errorCode: '400',
                error: 'Something went wrong',
                errors: {}
            }
            const apiErrorResponse = new ApiErrorResponse(response)

            const result = apiErrorResponse.getErrorCode()

            expect(result).toEqual('400')
        })

        it('returns undefined when the error code does not exist', () => {
            const response = {
                error: 'Something went wrong',
                errors: {}
            }
            const apiErrorResponse = new ApiErrorResponse(response)

            const result = apiErrorResponse.getErrorCode()

            expect(result).toBeUndefined()
        })
    })
})
