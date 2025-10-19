/**
 * Simple logger with configurable log levels
 * Uses stderr to not interfere with MCP stdio communication
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 999,
};

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.error('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.error('[INFO]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.error('[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  // Minimal startup info (always except when silent)
  startup(...args: any[]): void {
    if (this.level !== 'silent') {
      console.error(...args);
    }
  }
}

// Singleton instance
const logLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'error';
export const logger = new Logger(logLevel);
