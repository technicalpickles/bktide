import fs from 'node:fs';
import path from 'node:path';
import { pino } from 'pino';
// Unused with transport config approach
// import { createWriteStream } from 'node:fs';

// Ensure the log directory exists
const LOG_DIR = path.resolve(process.cwd(), 'log');
fs.mkdirSync(LOG_DIR, { recursive: true });

// Create file stream for JSON logs
const logFile = path.join(LOG_DIR, 'cli.log');
// Unused with transport config approach
// const fileStream = createWriteStream(logFile, { flags: 'a' });

// Create the logger
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    customLevels: {
      console: 80
    },
    transport: {
      targets: [
        // Regular console output
        {
          target: 'pino-pretty',
          level: 'console',
          options: {
            colorize: false,
            useOnlyCustomProps: true,
            sync: true,
            minimumLevel: 'console',
            ignore: 'level,time,pid,hostname'
          }
        },
        {
          target: 'pino-pretty',
          level: 'trace',
          options: {
            colorize: true,
            sync: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          }
        },
        // JSON file output
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
  }
);

// Convenience re-exports for existing codebases
export const { info, warn, error, debug, trace, fatal } = logger;

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