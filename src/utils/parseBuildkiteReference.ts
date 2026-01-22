export type BuildkiteReference =
  | { type: 'pipeline'; org: string; pipeline: string }
  | { type: 'build'; org: string; pipeline: string; buildNumber: number }
  | { type: 'build-with-step'; org: string; pipeline: string; buildNumber: number; stepId: string };

export function parseBuildkiteReference(input: string): BuildkiteReference {
  if (!input || input.trim() === '') {
    throw new Error('Invalid Buildkite reference: input cannot be empty');
  }

  const trimmed = input.trim();

  // Try URL format first
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return parseUrl(trimmed);
  }

  // Try hash format: org/pipeline#number
  if (trimmed.includes('#')) {
    return parseHashFormat(trimmed);
  }

  // Try slash format: org/pipeline or org/pipeline/number
  if (trimmed.includes('/')) {
    return parseSlashFormat(trimmed);
  }

  throw new Error(`Invalid Buildkite reference format: ${input}. Expected formats: org/pipeline, org/pipeline/number, org/pipeline#number, or https://buildkite.com/...`);
}

function parseUrl(input: string): BuildkiteReference {
  try {
    const url = new URL(input);
    
    if (url.hostname !== 'buildkite.com') {
      throw new Error(`Invalid Buildkite URL: expected buildkite.com, got ${url.hostname}`);
    }

    // Extract step ID from query parameter if present
    const stepId = url.searchParams.get('sid');

    // Parse path: /org/pipeline/builds/number or /org/pipeline/builds/number/steps/...
    const pathRegex = /^\/([^\/]+)\/([^\/]+)\/builds\/(\d+)/;
    const match = url.pathname.match(pathRegex);

    if (!match) {
      // Try pipeline URL: /org/pipeline
      const pipelineRegex = /^\/([^\/]+)\/([^\/]+)\/?$/;
      const pipelineMatch = url.pathname.match(pipelineRegex);
      
      if (pipelineMatch) {
        const [, org, pipeline] = pipelineMatch;
        return { type: 'pipeline', org, pipeline };
      }

      throw new Error(`Invalid Buildkite URL path: ${url.pathname}`);
    }

    const [, org, pipeline, buildNumberStr] = match;
    const buildNumber = parseInt(buildNumberStr, 10);

    if (isNaN(buildNumber)) {
      throw new Error(`Invalid build number: ${buildNumberStr}`);
    }

    if (stepId) {
      return { type: 'build-with-step', org, pipeline, buildNumber, stepId };
    }

    return { type: 'build', org, pipeline, buildNumber };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to parse Buildkite URL: ${input}`);
  }
}

function parseHashFormat(input: string): BuildkiteReference {
  const parts = input.split('#');
  
  if (parts.length !== 2) {
    throw new Error(`Invalid hash format: ${input}. Expected org/pipeline#number`);
  }

  const [pathPart, buildNumberStr] = parts;
  const pathSegments = pathPart.split('/').filter(s => s.length > 0);

  if (pathSegments.length !== 2) {
    throw new Error(`Invalid hash format: ${input}. Expected org/pipeline#number`);
  }

  const [org, pipeline] = pathSegments;
  const buildNumber = parseInt(buildNumberStr, 10);

  if (isNaN(buildNumber)) {
    throw new Error(`Invalid build number: ${buildNumberStr}`);
  }

  return { type: 'build', org, pipeline, buildNumber };
}

function parseSlashFormat(input: string): BuildkiteReference {
  // Remove trailing slash if present
  const normalized = input.endsWith('/') ? input.slice(0, -1) : input;
  const segments = normalized.split('/').filter(s => s.length > 0);

  if (segments.length === 2) {
    const [org, pipeline] = segments;
    return { type: 'pipeline', org, pipeline };
  }

  if (segments.length === 3) {
    const [org, pipeline, buildNumberStr] = segments;
    const buildNumber = parseInt(buildNumberStr, 10);

    if (isNaN(buildNumber)) {
      throw new Error(`Invalid build number: ${buildNumberStr}`);
    }

    return { type: 'build', org, pipeline, buildNumber };
  }

  throw new Error(`Invalid slash format: ${input}. Expected org/pipeline or org/pipeline/number`);
}
