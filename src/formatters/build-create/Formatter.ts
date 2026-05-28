import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';

export interface BuildCreateFormatterOptions {
  verb: 'created' | 'rebuilt';
}

export interface BuildCreateFormatter {
  formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string;
}

export abstract class BaseBuildCreateFormatter implements BuildCreateFormatter {
  abstract name: string;
  abstract formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string;
}
