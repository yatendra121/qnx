var winston=function(t,e,o){"use strict";let r="logs";o.existsSync(r)||o.mkdirSync(r);const i="debug",a=new e.transports.DailyRotateFile({level:i,filename:r+"/%DATE%.log",datePattern:"YYYY-MM-DD",zippedArchive:!0,handleExceptions:!0,maxSize:"20m",maxFiles:"14d",format:e.format.combine(e.format.errors({stack:!0}),e.format.timestamp(),e.format.json())}),l=e.createLogger({transports:[a],exceptionHandlers:[a],exitOnError:!1});return l.debug("Logging initialized at debug level"),t.logger=l,Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),t}({},winston,fs);
