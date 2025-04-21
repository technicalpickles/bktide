import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * XDG Base Directory Specification utility
 * https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */
export class XDGPaths {
  /**
   * Get XDG_CONFIG_HOME directory path
   * Defaults to $HOME/.config
   */
  static getConfigHome(): string {
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }

  /**
   * Get XDG_DATA_HOME directory path
   * Defaults to $HOME/.local/share
   */
  static getDataHome(): string {
    return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }

  /**
   * Get XDG_CACHE_HOME directory path
   * Defaults to $HOME/.cache
   */
  static getCacheHome(): string {
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  }

  /**
   * Get XDG_STATE_HOME directory path
   * Defaults to $HOME/.local/state
   */
  static getStateHome(): string {
    return process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  }

  /**
   * Get the appropriate application directory within an XDG directory
   * @param base XDG base directory
   * @param appName Application name
   * @param create Whether to create the directory if it doesn't exist
   */
  static getAppDir(base: string, appName: string, create = true): string {
    const dir = path.join(base, appName);
    if (create) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get application's cache directory
   * @param appName Application name
   * @param create Whether to create the directory if it doesn't exist
   */
  static getAppCacheDir(appName: string, create = true): string {
    return this.getAppDir(this.getCacheHome(), appName, create);
  }

  /**
   * Get application's config directory
   * @param appName Application name
   * @param create Whether to create the directory if it doesn't exist
   */
  static getAppConfigDir(appName: string, create = true): string {
    return this.getAppDir(this.getConfigHome(), appName, create);
  }

  /**
   * Get application's data directory
   * @param appName Application name
   * @param create Whether to create the directory if it doesn't exist
   */
  static getAppDataDir(appName: string, create = true): string {
    return this.getAppDir(this.getDataHome(), appName, create);
  }

  /**
   * Get application's state directory (for logs, etc.)
   * @param appName Application name
   * @param create Whether to create the directory if it doesn't exist
   */
  static getAppStateDir(appName: string, create = true): string {
    return this.getAppDir(this.getStateHome(), appName, create);
  }

  /**
   * Get application's log directory (typically in state home)
   * @param appName Application name
   * @param create Whether to create the directory if it doesn't exist
   */
  static getAppLogDir(appName: string, create = true): string {
    const logDir = path.join(this.getAppStateDir(appName, create), 'logs');
    if (create) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
  }
} 