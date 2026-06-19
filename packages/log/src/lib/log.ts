import chalk from 'chalk'

/**
 * Type representing the possible color names for log messages.
 */
type ColorName = 'red' | 'green' | 'cyan' | 'yellow'

/**
 * Type representing the possible types of log messages.
 */
type Type = 'info' | 'error' | 'success' | 'warning'

const log = console.log

/**
 * Configuration object mapping each log type to a corresponding color.
 */
const config: Record<Type, ColorName> = {
    info: 'cyan',
    error: 'red',
    success: 'green',
    warning: 'yellow'
}

/**
 * Logs a message to the console with a specific color based on the type.
 *
 * @param message - The message to be logged.
 * @param options - An object containing the type of the message. Defaults to 'info'.
 *
 * @example
 * consoleLog('This is an info message', { type: 'info' })
 * consoleLog('This is an error message', { type: 'error' })
 */
export function consoleLog(message: string, { type = 'info' }: { type?: Type } = {}): void {
    const color = config[type] ?? config.info
    log(chalk[color](message))
}
