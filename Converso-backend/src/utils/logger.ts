/**
 * Simple logger utility
 * TODO: Replace with proper logging library (Winston, Pino, etc.) in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  error: (message: string, error?: any, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
};

