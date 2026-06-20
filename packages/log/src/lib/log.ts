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
 * Presentation details for a log type: the accent color, the leading icon
 * and the label rendered before the message.
 */
interface TypeStyle {
    color: ColorName
    icon: string
    label: string
}

/**
 * Configuration object mapping each log type to its presentation style.
 */
const config: Record<Type, TypeStyle> = {
    info: { color: 'cyan', icon: 'ℹ', label: 'info' },
    success: { color: 'green', icon: '✔', label: 'success' },
    warning: { color: 'yellow', icon: '⚠', label: 'warning' },
    error: { color: 'red', icon: '✖', label: 'error' }
}

/** Width of the widest label, used to keep messages vertically aligned. */
const labelWidth = Math.max(...Object.values(config).map(({ label }) => label.length))

/**
 * Logs a message to the console, prefixed with a colored icon and label
 * based on the type.
 *
 * @param message - The message to be logged.
 * @param options - An object containing the type of the message. Defaults to 'info'.
 *
 * @example
 * consoleLog('This is an info message', { type: 'info' })
 * //  ℹ  info     This is an info message
 * consoleLog('This is an error message', { type: 'error' })
 * //  ✖  error    This is an error message
 */
export function consoleLog(message: string, { type = 'info' }: { type?: Type } = {}): void {
    const { color, icon, label } = config[type] ?? config.info

    const accent = chalk[color].bold
    log(` ${accent(icon)}  ${accent(label.padEnd(labelWidth))}  ${message}`)
}
