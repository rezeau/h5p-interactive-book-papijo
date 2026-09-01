'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const baseline = '70f3b6a211bf79491bf00f965fbbc57593289910';
const expectedReleaseIconSha256 = '64f4811ff17b33fd3182cc639e1a999202657270ff106cb3d27b8b5ba001c917';
const root = path.resolve(__dirname, '..');
const protectedFiles = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', baseline, '--', 'src', 'semantics.json', 'webpack.config.js', 'language'],
  { cwd: root, encoding: 'utf8' }
).trim().split(/\r?\n/).filter(Boolean);

const changed = [];
for (const file of protectedFiles) {
  const baselineBytes = execFileSync(
    'git',
    ['show', `${baseline}:${file}`],
    { cwd: root, encoding: 'buffer' }
  );
  const workingBytes = fs.readFileSync(path.join(root, file));
  if (!baselineBytes.equals(workingBytes)) {
    changed.push(file);
  }
}

if (changed.length > 0) {
  throw new Error(`Protected production files differ from ${baseline}: ${changed.join(', ')}`);
}

const iconHash = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'icon.svg')))
  .digest('hex');
if (iconHash !== expectedReleaseIconSha256) {
  throw new Error(`icon.svg does not match the reviewed release icon (${iconHash}).`);
}

console.log(`Production immutability validation passed against ${baseline} (${protectedFiles.length} protected files).`);
console.log(`Reviewed release icon SHA-256: ${iconHash.toUpperCase()}`);
