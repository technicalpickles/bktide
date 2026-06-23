import { describe, it, expect } from 'vitest';
import { getBuildCreateFormatter } from '../../src/formatters/build-create/index.js';

const build = {
  number: 4567,
  state: 'scheduled',
  web_url: 'https://buildkite.com/gusto/zp/builds/4567',
  pipeline: { slug: 'zp' },
};

describe('build-create formatters', () => {
  it('plain text shows the build number and URL', () => {
    const out = getBuildCreateFormatter('plain').formatBuild(build as any, { verb: 'created' });
    expect(out).toContain('#4567');
    expect(out).toContain('https://buildkite.com/gusto/zp/builds/4567');
    expect(out.toLowerCase()).toContain('created');
  });

  it('plain text supports the rebuilt verb', () => {
    const out = getBuildCreateFormatter('plain').formatBuild(build as any, { verb: 'rebuilt' });
    expect(out.toLowerCase()).toContain('rebuilt');
  });

  it('json returns the raw payload', () => {
    const out = getBuildCreateFormatter('json').formatBuild(build as any, { verb: 'created' });
    expect(JSON.parse(out)).toEqual(build);
  });

  it('alfred returns a single-item Alfred payload', () => {
    const out = getBuildCreateFormatter('alfred').formatBuild(build as any, { verb: 'created' });
    const parsed = JSON.parse(out);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].arg).toBe(build.web_url);
    expect(parsed.items[0].title).toContain('#4567');
  });
});
