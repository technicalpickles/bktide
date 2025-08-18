import { ShowBuildOptions } from '../../commands/ShowBuild.js';

export interface BuildDetail {
  build: any;
  jobs?: any[];
  annotations?: any[];
}

export interface BuildDetailFormatterOptions extends ShowBuildOptions {
  hasError?: boolean;
  errorMessage?: string;
  errorType?: 'access' | 'not_found' | 'api';
}

export abstract class BaseBuildDetailFormatter {
  abstract name: string;
  abstract formatBuildDetail(buildData: BuildDetail | null, options?: BuildDetailFormatterOptions): string;
  abstract formatError(action: string, error: any): string;
}
