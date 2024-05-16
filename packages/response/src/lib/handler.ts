import { errorApiResponse } from './response'
import { ApiResponse, initializeApiResponse } from './apiResponse'
import { ServerResponse } from 'http'
import type { NextFunction, Request as ExRequest, Response as ExResponse, Router } from 'express'

type ExecuteFun<T> = (
    req: T,
    res?: ExResponse,
    next?: NextFunction
) => Promise<ApiResponse> | Promise<void> | Promise<unknown>

function isFunction(value: unknown): boolean {
    return typeof value === 'function'
}

/**
 * This function is providing an async function that will handle response as well as any type of error
 * @param func
 * @returns handler
 */
export function asyncValidatorHandler<T extends ExRequest>(func: ExecuteFun<T>) {
    const handler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
        try {
            if (!isFunction(func))
                throw new TypeError('Provided parameter value is not a function.')

            const apiRes = await func(req as T, res, next)
            if (apiRes instanceof ApiResponse) {
                return apiRes.response(res)
            } else if (apiRes instanceof ServerResponse) {
                return apiRes
            } else if (apiRes === undefined) {
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
type ResourceController<T> = {
    [key in functionNames]?: ExecuteFun<T>
}

/**
 * This function will create resource route based on functions of provided controller
 * @param router
 * @param controller
 * @returns void
 */
export function resourceRoute<T extends ExRequest>(
    router: Router,
    controller: ResourceController<T>
) {
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
        const executeFun = controller[funName as keyof ResourceController<T>]
        if (executeFun)
            router.route(functionVal.url)[functionVal.method](asyncValidatorHandler<T>(executeFun))
    }
}
