import { transports as o, format as e, createLogger as i } from "winston";
import { existsSync as a, mkdirSync as l } from "fs";
import "path";
import "winston-daily-rotate-file";
const n = "logs";
let t = n;
a(t) || l(t);
const s = "debug", r = new o.DailyRotateFile({
  level: s,
  filename: t + "/%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: !0,
  handleExceptions: !0,
  maxSize: "20m",
  maxFiles: "14d",
  format: e.combine(e.errors({ stack: !0 }), e.timestamp(), e.json())
}), m = i({
  transports: [
    // new transports.Console({
    //     level: logLevel,
    //     format: format.combine(format.errors({ stack: true }), format.prettyPrint())
    // }),
    r
  ],
  exceptionHandlers: [r],
  exitOnError: !1
  // do not exit on handled exceptions
});
m.debug("Logging initialized at debug level");
export {
  m as logger
};
