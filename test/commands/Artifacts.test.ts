import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { ArtifactsList } from '../../src/commands/ArtifactsList.js';
import { ArtifactsDownload } from '../../src/commands/ArtifactsDownload.js';
import { clearTestData, server } from '../setup-simple.js';
import { logger } from '../../src/services/logger.js';
import { http, HttpResponse } from 'msw';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';
import type { BuildkiteArtifact } from '../../src/types/buildkite.js';

const MOCK_ARTIFACTS: BuildkiteArtifact[] = [
  {
    id: 'artifact-id-1', job_id: 'job-id-1',
    url: '', download_url: '',
    state: 'finished', path: 'dist/build.patch',
    dirname: 'dist', filename: 'build.patch',
    mime_type: 'text/x-diff', file_size: 4096, sha1sum: 'abc123',
  },
  {
    id: 'artifact-id-2', job_id: 'job-id-2',
    url: '', download_url: '',
    state: 'finished', path: 'reports/coverage.xml',
    dirname: 'reports', filename: 'coverage.xml',
    mime_type: 'application/xml', file_size: 131072, sha1sum: 'def456',
  },
];

describe('ArtifactsList Command', () => {
  let command: ArtifactsList;
  let consoleCalls: string[];

  beforeEach(() => {
    command = new ArtifactsList({ noCache: true });
    clearTestData();
    consoleCalls = [];
    vi.spyOn(logger, 'console').mockImplementation((msg: any) => {
      consoleCalls.push(String(msg));
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).__testOverride_rest_artifacts;
  });

  it('should list artifacts for a build reference', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
    });

    expect(exitCode).toBe(0);
    expect(consoleCalls.join('\n')).toContain('dist/build.patch');
    expect(consoleCalls.join('\n')).toContain('reports/coverage.xml');
  });

  it('should return 0 with empty message when no artifacts exist', async () => {
    server.use(
      http.get('https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds/:buildNumber/artifacts', () => {
        return HttpResponse.json([]);
      })
    );

    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
    });

    expect(exitCode).toBe(0);
    expect(consoleCalls.join('\n')).toContain('No artifacts');
  });

  it('should support JSON format', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      format: 'json',
    });

    expect(exitCode).toBe(0);
    const output = consoleCalls.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.count).toBe(2);
    expect(parsed.artifacts).toHaveLength(2);
  });

  it('should support Alfred format', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      format: 'alfred',
    });

    expect(exitCode).toBe(0);
    const output = consoleCalls.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].title).toBe('dist/build.patch');
  });

  it('should support URL build reference', async () => {
    const exitCode = await command.execute({
      buildRef: 'https://buildkite.com/org/pipeline/builds/123',
      token: 'test-token',
    });

    expect(exitCode).toBe(0);
  });

  it('should return 1 on API error', async () => {
    server.use(
      http.get('https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds/:buildNumber/artifacts', () => {
        return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
      })
    );

    const exitCode = await command.execute({
      buildRef: 'org/pipeline/999',
      token: 'test-token',
    });

    expect(exitCode).toBe(1);
  });
});

describe('ArtifactsDownload Command', () => {
  let command: ArtifactsDownload;
  let outDir: string;
  let consoleCalls: string[];
  let mockListArtifacts: ReturnType<typeof vi.fn>;
  let mockDownloadArtifact: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    command = new ArtifactsDownload({ noCache: true });
    clearTestData();
    outDir = await mkdtemp(join(tmpdir(), 'bktide-test-artifacts-'));
    consoleCalls = [];
    vi.spyOn(logger, 'console').mockImplementation((msg: any) => {
      consoleCalls.push(String(msg));
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    // Mock the REST client to avoid MSW binary body issues in node-fetch
    mockListArtifacts = vi.fn().mockResolvedValue(MOCK_ARTIFACTS);
    mockDownloadArtifact = vi.fn().mockImplementation(async (_org, _pipeline, _build, _jobId, _artifactId, destPath) => {
      await writeFile(destPath, 'fake-binary-content', { recursive: true } as any).catch(async () => {
        const { mkdir } = await import('fs/promises');
        await mkdir(require('path').dirname(destPath), { recursive: true });
        await writeFile(destPath, 'fake-binary-content');
      });
      return { path: destPath, size: 18 };
    });
    vi.spyOn(command, 'restClient', 'get').mockReturnValue({
      listBuildArtifacts: mockListArtifacts,
      downloadArtifact: mockDownloadArtifact,
    } as unknown as BuildkiteRestClient);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(outDir, { recursive: true, force: true });
  });

  it('should require --id or --path', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      out: outDir,
    });

    expect(exitCode).toBe(1);
    expect(consoleCalls.join('\n')).toContain('--id');
  });

  it('should download artifact by ID', async () => {
    mockDownloadArtifact.mockImplementation(async (_org, _pipeline, _build, _jobId, _artifactId, destPath) => {
      const { mkdir } = await import('fs/promises');
      await mkdir(join(outDir, 'dist'), { recursive: true });
      await writeFile(destPath, 'fake-binary-content');
      return { path: destPath, size: 18 };
    });

    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      id: 'artifact-id-1',
      out: outDir,
    });

    expect(exitCode).toBe(0);
    expect(mockDownloadArtifact).toHaveBeenCalledWith(
      'org', 'pipeline', 123, 'job-id-1', 'artifact-id-1',
      join(outDir, 'dist/build.patch')
    );
  });

  it('should download artifacts matching glob pattern', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      path: '*.patch',
      out: outDir,
    });

    expect(exitCode).toBe(0);
    // Only the .patch file should be downloaded (not .xml)
    expect(mockDownloadArtifact).toHaveBeenCalledTimes(1);
    expect(mockDownloadArtifact.mock.calls[0][4]).toBe('artifact-id-1');
  });

  it('should match glob against full path with matchBase', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      path: '*.xml',
      out: outDir,
    });

    expect(exitCode).toBe(0);
    expect(mockDownloadArtifact).toHaveBeenCalledTimes(1);
    expect(mockDownloadArtifact.mock.calls[0][4]).toBe('artifact-id-2');
  });

  it('should return 1 when glob matches nothing', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      path: '*.nonexistent',
      out: outDir,
    });

    expect(exitCode).toBe(1);
    expect(consoleCalls.join('\n')).toContain('No artifacts match');
  });

  it('should return 1 when ID does not match any artifact', async () => {
    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      id: 'nonexistent-id',
      out: outDir,
    });

    expect(exitCode).toBe(1);
    expect(consoleCalls.join('\n')).toContain('No artifact found');
  });

  it('should return 1 when download fails', async () => {
    mockDownloadArtifact.mockRejectedValue(new Error('Artifact download failed (403): presigned URL request failed'));

    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      id: 'artifact-id-1',
      out: outDir,
    });

    expect(exitCode).toBe(1);
    expect(consoleCalls.join('\n')).toContain('✖');
  });

  it('should skip expired/deleted artifacts', async () => {
    mockListArtifacts.mockResolvedValue([{
      ...MOCK_ARTIFACTS[0],
      id: 'artifact-expired',
      state: 'expired',
    }]);

    const exitCode = await command.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      id: 'artifact-expired',
      out: outDir,
    });

    expect(exitCode).toBe(1);
    expect(mockDownloadArtifact).not.toHaveBeenCalled();
  });
});
