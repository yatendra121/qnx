export * from './lib'

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

export const est = () => {
    return 'ok'
}
