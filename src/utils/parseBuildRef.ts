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
  const urlRegex = /^https?:\/\/buildkite\.com\/([^\/]+)\/([^\/]+)\/builds\/(\d+)$/;
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

  // Try hash format: org/pipeline#number (GitHub-style)
  const hashRegex = /^([^\/]+)\/([^#]+)#(\d+)$/;
  const hashMatch = cleanInput.match(hashRegex);

  if (hashMatch) {
    const [, org, pipeline, numberStr] = hashMatch;
    const number = parseInt(numberStr, 10);

    if (isNaN(number)) {
      throw new Error(`Invalid build number: ${numberStr}`);
    }

    return { org, pipeline, number };
  }

  throw new Error(`Invalid build reference format: ${input}. Expected org/pipeline/number, org/pipeline#number, or @https://buildkite.com/org/pipeline/builds/number`);
}
