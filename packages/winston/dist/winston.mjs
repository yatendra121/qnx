import { transports as o, format as e, createLogger as l } from "winston";
import { existsSync as n, mkdirSync as a } from "fs";
import "path";
import "winston-daily-rotate-file";
const s = "logs";
let t = s;
n(t) || a(t);
const i = "debug", r = new o.DailyRotateFile({
  level: i,
  filename: t + "/%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: !0,
  handleExceptions: !0,
  maxSize: "20m",
  maxFiles: "14d",
  format: e.combine(e.errors({ stack: !0 }), e.timestamp(), e.json())
}), m = l({
  transports: [
    new o.Console({
      level: i,
      format: e.combine(e.errors({ stack: !0 }), e.prettyPrint())
    }),
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
