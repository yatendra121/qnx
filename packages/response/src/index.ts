export * from './lib/api-helpers-response'
export * from './lib/apiResponse'

export const errorFormatter = ({ msg }: { msg: string }) => {
    // {
    //     location,
    //     msg,
    //     param,
    //     value,
    //     nestedErrors
    // }

    // console.log({
    //     location,
    //     msg,
    //     param,
    //     value,
    //     nestedErrors
    // })
    return [msg]
}
