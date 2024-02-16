import chalk from 'chalk'

type ColorName = 'red' | 'green' | 'cyan' | 'yellow'

type Type = 'info' | 'error' | 'success' | 'warning'

const log = console.log

const config: Record<Type, ColorName> = {
    info: 'cyan',
    error: 'red',
    success: 'green',
    warning: 'yellow'
}

export function consoleLog({ message, type }: { message: string; type: Type }): void {
    log(chalk[config[type]](message))
}
