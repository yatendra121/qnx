export * from './api-helpers-response'
export * from './api-response-errors-value'

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
