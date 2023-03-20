export * from './response'
export * from './apiResponseErrorsValue'
export * from './handler'
export * from './apiResponse'

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
