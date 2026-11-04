export * from './lib/generator'
export { collectTypeValue } from './lib'

export function isFunction(functionToCheck: unknown): boolean {
    return typeof functionToCheck === 'function'
}
