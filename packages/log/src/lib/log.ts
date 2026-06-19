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
 * and the label rendered inside the badge.
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
    info: { color: 'cyan', icon: 'ℹ', label: 'INFO' },
    success: { color: 'green', icon: '✔', label: 'SUCCESS' },
    warning: { color: 'yellow', icon: '⚠', label: 'WARNING' },
    error: { color: 'red', icon: '✖', label: 'ERROR' }
}

/** Width of the widest label, used to keep the badges and messages aligned. */
const labelWidth = Math.max(...Object.values(config).map(({ label }) => label.length))

/** Maps a foreground color name to its chalk background counterpart, e.g. `cyan` -> `bgCyan`. */
const bgColor = (color: ColorName) =>
    `bg${color[0].toUpperCase()}${color.slice(1)}` as `bg${Capitalize<ColorName>}`

/**
 * Logs a message to the console, prefixed with a colored icon and a filled
 * label badge based on the type.
 *
 * @param message - The message to be logged.
 * @param options - An object containing the type of the message. Defaults to 'info'.
 *
 * @example
 * consoleLog('This is an info message', { type: 'info' })
 * // ℹ  INFO     This is an info message
 * consoleLog('This is an error message', { type: 'error' })
 * // ✖  ERROR    This is an error message
 */
export function consoleLog(message: string, { type = 'info' }: { type?: Type } = {}): void {
    const { color, icon, label } = config[type] ?? config.info

    const styledIcon = chalk[color].bold(icon)
    const badge = chalk[bgColor(color)].black.bold(` ${label.padEnd(labelWidth)} `)

    log(`${styledIcon} ${badge}  ${message}`)
}
