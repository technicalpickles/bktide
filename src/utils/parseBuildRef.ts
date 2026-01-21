export interface BuildRef {
  org: string;
  pipeline: string;
  number: number;
}

export function parseBuildRef(input: string): BuildRef {
  if (!input) {
    throw new Error('Build reference is required');
  }

  // Remove optional leading @
  const cleanInput = input.startsWith('@') ? input.slice(1) : input;

  // Try URL format first: https://buildkite.com/org/pipeline/builds/number
  // Allow trailing path segments (e.g., /steps/canvas) to support pasting URLs from browser
  const urlRegex = /^https?:\/\/buildkite\.com\/([^\/]+)\/([^\/]+)\/builds\/(\d+)(?:\/.*)?$/;
  const urlMatch = cleanInput.match(urlRegex);
  
  if (urlMatch) {
    const [, org, pipeline, numberStr] = urlMatch;
    const number = parseInt(numberStr, 10);
    
    if (isNaN(number)) {
      throw new Error(`Invalid build number: ${numberStr}`);
    }
    
    return { org, pipeline, number };
  }

  // Try slug format: org/pipeline/number
  const slugRegex = /^([^\/]+)\/([^\/]+)\/(\d+)$/;
  const slugMatch = cleanInput.match(slugRegex);
  
  if (slugMatch) {
    const [, org, pipeline, numberStr] = slugMatch;
    const number = parseInt(numberStr, 10);
    
    if (isNaN(number)) {
      throw new Error(`Invalid build number: ${numberStr}`);
    }
    
    return { org, pipeline, number };
  }

  throw new Error(`Invalid build reference format: ${input}. Expected org/pipeline/number or @https://buildkite.com/org/pipeline/builds/number`);
}
