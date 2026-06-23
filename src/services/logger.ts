import fs from 'node:fs';
import path from 'node:path';
import { pino } from 'pino';
import { XDGPaths } from '../utils/xdgPaths.js';

const logDir = XDGPaths.getAppLogDir('bktide');
fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, 'cli.log');

// Check for debug flag early, before Commander parses options.
// Pino transports filter at initialization time (worker threads with immutable config),
// so we need to know the level before creating the logger.
const debugFlagPresent = process.argv.some(arg => arg === '--debug' || arg === '-d');
const effectiveLevel = debugFlagPresent ? 'debug' : (process.env.LOG_LEVEL || 'info');

export const logger = pino(
  {
    level: effectiveLevel,
    customLevels: {
      console: 80
    },
    transport: {
      targets: [
        // Direct console output (no pretty formatting)
        {
          target: 'pino-pretty',
          level: 'console',
          options: {
            colorize: false,
            useOnlyCustomProps: true,
            sync: true,
            minimumLevel: 'console',
            ignore: 'level,time,pid,hostname',
            errorProps: 'err,error,stack,message,code,details'
          }
        },
        // Debug output with pretty formatting (to stderr)
        {
          target: 'pino-pretty',
          level: effectiveLevel,  // Only show when --debug or LOG_LEVEL enables it
          options: {
            destination: 2,  // stderr - keeps debug separate from stdout for JSON/Alfred
            colorize: true,
            sync: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'time,pid,hostname',
            errorProps: 'err,error,stack,message,code,details'
          }
        },
        // JSON file output for detailed logging
        {
          target: 'pino/file',
          level: 'trace',
          options: { 
            destination: logFile,
            mkdir: true,
            sync: false 
          }
        }
      ],
      dedupe: true
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      stack: (stack: string) => stack,
      details: (details: any) => details
    }
  }
);

// Convenience re-exports for existing codebases
export const { info, warn, error, debug, trace, fatal } = logger;

/**
 * Changes the logging level of the current logger instance.
 * Note: This only affects the logger threshold, not transport filtering.
 * For debug output to stderr, use --debug flag or LOG_LEVEL env var at startup.
 * @param level The new log level to set
 */
export function setLogLevel(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'console'): void {
  logger.level = level;
}

/**
 * Helper function to measure and log execution time of async functions
 * @param label Description of the operation being timed
 * @param fn Function to execute and time
 * @param level Log level to use for output (defaults to 'debug')
 * @returns Result of the function execution
 */
export async function timeIt<T>(
  label: string, 
  fn: () => Promise<T>, 
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' = 'debug'
): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    switch(level) {
      case 'trace': logger.trace({ duration }, `${label} completed in ${duration.toFixed(2)}ms`); break;
      case 'debug': logger.debug({ duration }, `${label} completed in ${duration.toFixed(2)}ms`); break;
      case 'info': logger.info({ duration }, `${label} completed in ${duration.toFixed(2)}ms`); break;
      case 'warn': logger.warn({ duration }, `${label} completed in ${duration.toFixed(2)}ms`); break;
      case 'error': logger.error({ duration }, `${label} completed in ${duration.toFixed(2)}ms`); break;
      case 'fatal': logger.fatal({ duration }, `${label} completed in ${duration.toFixed(2)}ms`); break;
    }
  }
} 