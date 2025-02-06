import { errorApiResponse } from './response'
import { ApiResponse, initializeApiResponse } from './apiResponse'
import { ServerResponse } from 'http'
import type { NextFunction, Request as ExRequest, Response as ExResponse, Router } from 'express'

/**
 * Type definition for the execute function, which is an asynchronous function
 * that handles a request and optionally a response and next function.
 */
type ExecuteFun<T> = (
    req: T,
    res: ExResponse,
    next: NextFunction
) => Promise<ApiResponse> | Promise<void> | Promise<unknown>

/**
 * Checks if a value is a function.
 *
 * @param value - The value to check.
 * @returns True if the value is a function, otherwise false.
 */
function isFunction(value: unknown): boolean {
    return typeof value === 'function'
}

/**
 * Provides an asynchronous function that handles responses and any type of error.
 *
 * @param  func - The function to be executed.
 * @returns A handler function that executes the given function and manages responses and errors.
 */
export function asyncValidatorHandler<T extends ExRequest>(func: ExecuteFun<T>) {
    const handler = async (req: ExRequest, res: ExResponse, next: NextFunction): Promise<void> => {
        try {
            if (!isFunction(func)) {
                throw new TypeError('Provided parameter value is not a function.')
            }

            const apiRes = await func(req as T, res, next)

            if (apiRes instanceof ApiResponse) {
                return void apiRes.response(res) // Ensure the return value is ignored
            }

            if (apiRes instanceof ServerResponse || apiRes === undefined) {
                return next()
            }

            initializeApiResponse().setData(apiRes).response(res)
        } catch (error: unknown) {
            errorApiResponse(res, error as Error)
        }
    }

    return handler
}

/**
 * Type definition for the names of resource controller functions.
 */
type functionNames = 'changeStatus' | 'create' | 'findAll' | 'findOne' | 'update' | 'remove'

/**
 * Type definition for resource routes, mapping function names to their HTTP method and URL.
 */
type ResourceRoutes = {
    [key in functionNames]: {
        method: 'get' | 'post' | 'put' | 'delete'
        url: string
    }
}

/**
 * Type definition for a resource controller, mapping function names to their execute functions.
 */
type ResourceController<T> = {
    [key in functionNames]?: ExecuteFun<T>
}

/**
 * Creates resource routes based on the functions of the provided controller.
 *
 * @param router - The Express router to define the routes on.
 * @param controller - The controller containing the execute functions for each route.
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
