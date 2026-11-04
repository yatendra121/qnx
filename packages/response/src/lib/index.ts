export * from './response'
export {
    /** @deprecated Import `ApiResponseErrorsValue` from `@qnx/errors` instead. */
    ApiResponseErrorsValue
} from '@qnx/errors'
export * from './handler'
export * from './apiResponse'
export * from './errorResponse'

export const errorFormatter = ({ msg }: { msg: string }) => {
    // console.log({
    //     location,
    //     msg,
    //     param,
    //     value,
    //     nestedErrors,
    // });
    return [msg]
}
