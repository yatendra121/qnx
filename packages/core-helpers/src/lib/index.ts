export function coreHelpers(): string {
    return 'core-helpers'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const collectTypeValue = <T>(value: any, defaultValue: T): T => {
    let returnValue = value ?? defaultValue

    switch (typeof defaultValue) {
        case 'number':
            returnValue = Number(returnValue)
            break
    }
    return returnValue
}
