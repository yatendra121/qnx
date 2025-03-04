import { createLogger, transports, format } from 'winston'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import 'winston-daily-rotate-file'

const logDirectory = 'logs'
const environment = 'development'

let dir = logDirectory
if (!dir) dir = resolve('logs')

// create directory if it is not present
if (!existsSync(dir)) {
    // Create the directory if it does not exist
    mkdirSync(dir)
}

const logLevel = environment === 'development' ? 'debug' : 'warn'

const dailyRotateFile = new transports.DailyRotateFile({
    level: logLevel,
    filename: dir + '/%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    handleExceptions: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: format.combine(format.errors({ stack: true }), format.timestamp(), format.json())
})

export const logger = createLogger({
    transports: [
        // new transports.Console({
        //     level: logLevel,
        //     format: format.combine(format.errors({ stack: true }), format.prettyPrint())
        // }),
        dailyRotateFile
    ],
    exceptionHandlers: [dailyRotateFile],
    exitOnError: false // do not exit on handled exceptions
})

if (environment === 'development') {
    logger.debug('Logging initialized at debug level')
}
