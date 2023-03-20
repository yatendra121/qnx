import { errorApiResponse } from './response'
import { ApiResponse, initializeApiResponse } from './apiResponse'
import type { NextFunction, Request, Response } from '@qnx/interfaces'

export function asyncValidatorHandler<T = Request>(
    func: (req: T) => Promise<ApiResponse> | Promise<void> | Promise<unknown>
) {
    const handler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            const apiRes = await func(req)
            if (apiRes instanceof ApiResponse) {
                return apiRes.response(res)
            } else if (!apiRes) {
                return next()
            } else {
                return initializeApiResponse().setData(apiRes).response(res)
            }
        } catch (error) {
            return errorApiResponse(res, error)
        }
    }

    return handler
}
