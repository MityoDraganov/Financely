export interface LoggerService {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

export const loggerService: LoggerService = {
  info(message: string, data?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },

  error(message: string, data?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },

  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
};
