import type { Response as ExResponse } from 'express'

export interface CapturedResponse {
    statusCode: number
    body: unknown
}

/**
 * Runs real @qnx/response code against a stand-in for Express's `res` and returns what it sent,
 * so a preview shows what the library does rather than a copy of its behaviour that can drift.
 */
export function captureResponse(send: (res: ExResponse) => unknown): CapturedResponse {
    const captured: CapturedResponse = { statusCode: 200, body: undefined }
    const res = {
        headersSent: false,
        status(code: number) {
            captured.statusCode = code
            return res
        },
        send(body: unknown) {
            // What a client receives: JSON has no undefined values or class instances.
            captured.body = JSON.parse(JSON.stringify(body))
            return res
        }
    }
    send(res as unknown as ExResponse)
    return captured
}

/** Node and Express reject anything else, so the response never reaches the client. */
export function isValidStatusCode(code: number) {
    return Number.isInteger(code) && code >= 100 && code <= 999
}

export const INVALID_STATUS_MESSAGE =
    'Express throws a RangeError for a status code outside 100-999, so no error response is sent and the request falls through to the app\'s error handler.'
