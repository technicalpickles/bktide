#!/usr/bin/env node

/**
 * Test the material change detection logic
 * This script tests various file patterns to verify detection works correctly
 */

import { isFileMaterial } from './detect-material-changes.js';

const testCases = [
  // Material changes - should trigger release
  { file: 'src/index.ts', expected: true, reason: 'Source code' },
  { file: 'src/commands/NewCommand.ts', expected: true, reason: 'Source code' },
  { file: 'package.json', expected: true, reason: 'Package config' },
  { file: 'package-lock.json', expected: true, reason: 'Dependencies' },
  { file: 'tsconfig.json', expected: true, reason: 'Build config' },
  { file: 'bin/bktide', expected: true, reason: 'Binary' },
  { file: 'bin/alfred-entrypoint', expected: true, reason: 'Alfred binary' },
  { file: 'icons/passed.png', expected: true, reason: 'Icon asset' },
  { file: 'icon.png', expected: true, reason: 'Main icon' },
  { file: 'info.plist', expected: true, reason: 'Alfred metadata' },
  { file: 'README.md', expected: true, reason: 'Package readme' },
  { file: 'WORKFLOW_README.md', expected: true, reason: 'Workflow readme' },
  { file: 'LICENSE', expected: true, reason: 'License file' },
  { file: 'env.example', expected: true, reason: 'Config template' },
  { file: 'scripts/package-workflow.js', expected: true, reason: 'Build script' },
  { file: 'scripts/compute-version.js', expected: true, reason: 'Version script' },
  { file: 'src/graphql/queries.ts', expected: true, reason: 'GraphQL queries' },
  { file: 'src/graphql/generated/graphql.ts', expected: true, reason: 'Generated GraphQL types' },
  { file: 'src/graphql/generated/sdk.ts', expected: true, reason: 'Generated GraphQL SDK' },
  { file: 'codegen.mjs', expected: true, reason: 'Codegen config' },
  
  // Non-material changes - should NOT trigger release
  { file: '.github/workflows/ci.yml', expected: false, reason: 'CI workflow' },
  { file: '.github/workflows/release.yml', expected: false, reason: 'Release workflow' },
  { file: 'docs/development.md', expected: false, reason: 'Documentation' },
  { file: 'docs/planning/annotations-plan.md', expected: false, reason: 'Planning doc' },
  { file: 'CONTRIBUTING.md', expected: false, reason: 'Contributing guide' },
  { file: 'scripts/test-script.js', expected: false, reason: 'Non-critical script' },
  { file: 'lefthook.yml', expected: false, reason: 'Dev tooling' },
  { file: 'mise.toml', expected: false, reason: 'Dev tooling' },
  { file: '.cursor/rules/00-project-overview.mdc', expected: false, reason: 'Editor config' },
  { file: 'bk-cli/src/main.rs', expected: false, reason: 'Different project' },
  { file: 'log/debug.log', expected: false, reason: 'Log file' },
  { file: 'pkg/bktide-workflow-1.0.0.alfredworkflow', expected: false, reason: 'Build artifact' },
  { file: '.stage/workflow/package.json', expected: false, reason: 'Staging file' },
  { file: 'dist/index.js', expected: false, reason: 'Generated JS file' }
];

console.log('Testing Material Change Detection\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = isFileMaterial(test.file);
  const status = result === test.expected ? '✅' : '❌';
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  const expectedText = test.expected ? 'MATERIAL' : 'non-material';
  const resultText = result ? 'MATERIAL' : 'non-material';
  
  console.log(
    `${status} ${test.file.padEnd(50)} ${expectedText.padEnd(12)} (${test.reason})`
  );
  
  if (result !== test.expected) {
    console.log(`   Expected: ${expectedText}, Got: ${resultText}`);
  }
}

console.log('='.repeat(70));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  process.exit(0);
}
