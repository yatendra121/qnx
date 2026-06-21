import chalk from 'chalk'

/**
 * Type representing the accent color used for each log type.
 */
type ColorName = 'blue' | 'green' | 'yellow' | 'red' | 'magenta' | 'cyan'

/**
 * Type representing the possible types of log messages.
 */
type Type = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'trace'

const log = console.log

/**
 * Presentation details for a log type: the color and its outline icon.
 */
interface TypeStyle {
    color: ColorName
    icon: string
}

/**
 * Configuration object mapping each log type to its color and outline icon.
 */
const config: Record<Type, TypeStyle> = {
    info: { color: 'blue', icon: 'ⓘ' },
    success: { color: 'green', icon: '✓' },
    warn: { color: 'yellow', icon: '⚠' },
    error: { color: 'red', icon: '✗' },
    debug: { color: 'magenta', icon: '◇' },
    trace: { color: 'cyan', icon: '☆' }
}

/**
 * Logs a message to the console, prefixed with an outline icon and colored
 * according to its type.
 *
 * @param message - The message to be logged.
 * @param options - An object containing the type of the message. Defaults to 'info'.
 *
 * @example
 * consoleLog('Server started successfully', { type: 'info' })
 * // ⓘ  Server started successfully
 * consoleLog('Failed to connect to database', { type: 'error' })
 * // ✗  Failed to connect to database
 */
export function consoleLog(message: string, { type = 'info' }: { type?: Type } = {}): void {
    const { color, icon } = config[type] ?? config.info
    log(chalk[color](`${icon}  ${message}`))
}
