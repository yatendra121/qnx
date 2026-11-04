import { ApiResponseErrorsValue as ErrorsApiResponseErrorsValue } from '@qnx/errors'
import { ApiResponseErrorsValue } from '../../index'
import { describe, test, expect } from 'vitest'

describe('ApiResponseErrorsValue', () => {
    test('should still be exported, as the same class as @qnx/errors', () => {
        expect(ApiResponseErrorsValue).toBe(ErrorsApiResponseErrorsValue)
    })
})
