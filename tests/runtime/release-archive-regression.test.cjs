'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('release archive contains nested files without explicit directory entries and rejects directory records', () => {
  const script = path.join(__dirname, 'release-archive-regression.ps1');
  const result = spawnSync('pwsh', ['-NoProfile', '-File', script], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8'
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /zero directory entries, explicit directory rejected/);
});
