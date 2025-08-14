#!/usr/bin/env node

// Compute next release version following scheme:
// MAJOR.MINOR.PATCH[-<pre>.<suffix>]
// - MAJOR.MINOR come from package.json (manually curated for compatibility semantics)
// - PATCH is UTC epoch seconds at release time (monotonic numeric SemVer identifier)
// - Optional prerelease, e.g. -pr.123 or -beta.1
// The script avoids tag collisions by checking existing git tags and incrementing PATCH if needed.

import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function getArgValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function runGit(args) {
  const res = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  if (res.status !== 0) {
    // best-effort; return empty on failure
    return '';
  }
  return res.stdout.trim();
}

async function readPackageJson() {
  const pkgPath = path.join(rootDir, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf-8');
  return JSON.parse(raw);
}

function parseSemver(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/);
  if (!m) throw new Error(`Invalid semver in package.json: ${version}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function listTagsMatching(prefix) {
  const pattern = `${prefix}`; // e.g., v1.2.
  const out = runGit(['tag', '--list', `${pattern}*`]);
  if (!out) return [];
  return out.split('\n').filter(Boolean);
}

function tagExists(tag) {
  const out = runGit(['tag', '--list', tag]);
  return out.split('\n').some((t) => t.trim() === tag);
}

function toEpochSecondsUTC(date) {
  return Math.floor(date.getTime() / 1000);
}

async function main() {
  try {
    const pkg = await readPackageJson();
    const { major, minor } = parseSemver(pkg.version);

    // Allow overriding epoch seconds for testing
    const epochOverride = getArgValue('--epoch');
    const initialPatch = epochOverride ? Number(epochOverride) : toEpochSecondsUTC(new Date());

    // Compose base and ensure uniqueness against existing tags
    let patch = initialPatch;
    const pre = getArgValue('--pre'); // e.g., pr, beta
    const suffix = getArgValue('--suffix'); // e.g., 123 or pr.45.6 already formatted by caller

    // Avoid collisions with existing tags
    // We'll check tags of form vMAJOR.MINOR.PATCH with or without prerelease.
    // If a collision occurs on the base (without prerelease), increment patch until free.
    while (true) {
      const baseTag = `v${major}.${minor}.${patch}`;
      if (!tagExists(baseTag)) break;
      patch += 1;
    }

    let version = `${major}.${minor}.${patch}`;
    if (pre) {
      if (suffix) {
        version += `-${pre}.${suffix}`;
      } else {
        version += `-${pre}.1`;
      }
    }

    // Output only the version string
    process.stdout.write(version);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

await main();


