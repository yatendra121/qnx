import { errorApiResponse } from './response'
import { ApiResponse, initializeApiResponse } from './apiResponse'
import type { NextFunction, Request, Response, Router } from 'express'

type ExecuteFun<T = Request> = (req: T) => Promise<ApiResponse> | Promise<void> | Promise<unknown>

export function asyncValidatorHandler<T = Request>(func: ExecuteFun<T>) {
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
        } catch (error: unknown) {
            const err = error as Error
            return errorApiResponse(res, err)
        }
    }

    return handler
}

type functionNames = 'changeStatus' | 'create' | 'findAll' | 'findOne' | 'update' | 'remove'
type ResourceRoutes = {
    [key in functionNames]: {
        method: 'get' | 'post' | 'put' | 'delete'
        url: string
    }
}
type ResourceController = {
    [key in functionNames]?: ExecuteFun
}

export function resourceRoute(router: Router, controller: ResourceController) {
    const resourceRoutes: ResourceRoutes = {
        changeStatus: { method: 'put', url: '/change-status/:id' },
        create: { method: 'post', url: '/' },
        findAll: { method: 'get', url: '/' },
        findOne: { method: 'get', url: '/:id' },
        update: { method: 'put', url: '/:id' },
        remove: { method: 'delete', url: '/:id' }
    }

    for (const funName in resourceRoutes) {
        const functionVal = resourceRoutes[funName as keyof ResourceRoutes]
        const executeFun = controller[funName as keyof ResourceController]
        if (executeFun)
            router.route(functionVal.url)[functionVal.method](asyncValidatorHandler(executeFun))
    }
}
