import chalk from 'chalk'

/**
 * Type representing the accent color used for each log type.
 */
type ColorName = 'blue' | 'green' | 'yellow' | 'red' | 'magenta' | 'cyan'

/**
 * Type representing the possible types of log messages.
 * `warning` is kept as an alias of `warn` for backward compatibility.
 */
type Type = 'info' | 'success' | 'warn' | 'warning' | 'error' | 'debug' | 'trace'

const log = console.log

/**
 * Presentation details for a log type: the color and its outline icon.
 */
interface TypeStyle {
    color: ColorName
    icon: string
}

const warn: TypeStyle = { color: 'yellow', icon: '⚠' }

/**
 * Configuration object mapping each log type to its color and outline icon.
 */
const config: Record<Type, TypeStyle> = {
    info: { color: 'blue', icon: 'ⓘ' },
    success: { color: 'green', icon: '✓' },
    warn,
    warning: warn,
    error: { color: 'red', icon: '✗' },
    debug: { color: 'magenta', icon: '◇' },
    trace: { color: 'cyan', icon: '☆' }
}

/**
 * Upper bound on how many `cause` links are followed, guarding against cycles.
 */
const MAX_CAUSE_DEPTH = 10

/**
 * Renders an error with its stack trace, followed by its `cause` chain.
 */
function formatError(error: Error): string {
    const lines: string[] = []
    let current: unknown = error

    for (let depth = 0; current !== undefined && depth <= MAX_CAUSE_DEPTH; depth++) {
        const text =
            current instanceof Error
                ? current.stack || `${current.name}: ${current.message}`
                : formatValue(current)
        lines.push(depth === 0 ? text : `Caused by: ${text}`)
        current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined
    }

    return lines.join('\n')
}

/**
 * Converts any non-error value to printable text.
 */
function formatValue(value: unknown): string {
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return String(value)
        }
    }
    return String(value)
}

/**
 * Logs a message to the console, prefixed with an outline icon and colored
 * according to its type. Errors are printed with their stack trace (dimmed)
 * and `cause` chain.
 *
 * @param message - The message to be logged: a string, an `Error`, or any other value.
 * @param options - An object containing the type of the message. Defaults to 'info'.
 *
 * @example
 * consoleLog('Server started successfully', { type: 'info' })
 * // ⓘ  Server started successfully
 *
 * try {
 *     connect()
 * } catch (err) {
 *     consoleLog(err, { type: 'error' })
 *     // ✗  Error: Failed to connect to database
 *     //     at connect (db.ts:12:11)
 * }
 */
export function consoleLog(message: unknown, { type = 'info' }: { type?: Type } = {}): void {
    const { color, icon } = config[type] ?? config.info

    if (message instanceof Error) {
        const [head, ...rest] = formatError(message).split('\n')
        log([chalk[color](`${icon}  ${head}`), ...rest.map((line) => chalk.dim(line))].join('\n'))
        return
    }

    log(chalk[color](`${icon}  ${formatValue(message)}`))
}
