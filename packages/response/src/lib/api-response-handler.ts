import { NextFunction, Request, Response } from '@qnx/interfaces'
import { errorApiResponse } from './api-helpers-response'
import { ApiResponse } from './apiResponse'

export function asyncValidatorHandler(
    func: (req: Request, res?: Response, next?: NextFunction) => Promise<void | ApiResponse>
) {
    const handler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const apiRes = await func(req, res, next)
            return apiRes && apiRes.response(res)
        } catch (error) {
            return errorApiResponse(res, error)
        }
    }

    return handler
}
