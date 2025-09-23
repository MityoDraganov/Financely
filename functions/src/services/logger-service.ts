import * as functionsLogger from "firebase-functions/logger";

import { LoggerService } from "../core";

export const loggerService: LoggerService = {
  info(...args: any[]) {
    functionsLogger.info(...args);
  },
  warn(...args: any[]) {
    functionsLogger.warn(...args);
  },
  error(...args: any[]) {
    functionsLogger.error(...args);
  },
  debug(...args: any[]) {
    functionsLogger.debug(...args);
  },
};

