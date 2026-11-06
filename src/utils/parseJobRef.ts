export interface JobRef {
  jobId: string;
  /** Present when the reference names the build (URL or slug form). */
  org?: string;
  pipeline?: string;
  buildNumber?: number;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(`^${UUID}$`, 'i');
const URL_RE = new RegExp(
  `^https?://buildkite\\.com/([^/]+)/([^/]+)/builds/(\\d+)[^#]*#(${UUID})$`,
  'i',
);
const BUILD_URL_RE = /^https?:\/\/buildkite\.com\/[^/]+\/[^/]+\/builds\/\d+/i;
const SLUG_RE = new RegExp(`^([^/]+)/([^/]+)/(\\d+)#(${UUID})$`, 'i');

const EXPECTED =
  'Expected a job UUID, org/pipeline/number#<job-uuid>, or https://buildkite.com/org/pipeline/builds/number#<job-uuid>';

/**
 * Parse a reference to a single job. Accepts a bare job UUID, a slug with a
 * job fragment (org/pipeline/123#<uuid>), or a build URL with a job fragment,
 * which is the form job links and GitHub check runs use.
 */
export function parseJobRef(input: string): JobRef {
  if (!input || input.trim() === '') {
    throw new Error(`Job reference is required. ${EXPECTED}`);
  }

  const clean = input.trim().replace(/^@/, '');

  if (UUID_RE.test(clean)) {
    return { jobId: clean.toLowerCase() };
  }

  const match = clean.match(URL_RE) ?? clean.match(SLUG_RE);
  if (match) {
    const [, org, pipeline, numberStr, jobId] = match;
    return { org, pipeline, buildNumber: parseInt(numberStr, 10), jobId: jobId.toLowerCase() };
  }

  if (BUILD_URL_RE.test(clean)) {
    throw new Error(
      `This URL points at a build, not a job: ${input}\n` +
      'Copy the link to a specific job (it ends in #<job-uuid>), ' +
      'or use "bktide build retry-failed" to retry every failed job in the build.',
    );
  }

  throw new Error(`Invalid job reference: ${input}. ${EXPECTED}`);
}
