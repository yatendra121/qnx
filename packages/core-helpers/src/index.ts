export * from './lib/generator'

export function isFunction(functionToCheck: unknown): boolean {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'
        ? true
        : false
}
