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
  ['ls-tree', '-r', '--name-only', baseline, '--', 'src', 'webpack.config.js', 'language'],
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

const baselineSemantics = JSON.parse(execFileSync(
  'git',
  ['show', `${baseline}:semantics.json`],
  { cwd: root, encoding: 'utf8' }
));
const expectedSemantics = structuredClone(baselineSemantics);
const chapterLibrary = expectedSemantics
  .find((field) => field.name === 'chapters')
  ?.field.fields.find((field) => field.name === 'chapter');
if (!chapterLibrary || JSON.stringify(chapterLibrary.options) !== JSON.stringify(['H5P.ColumnPapiJo 1.17'])) {
  throw new Error('The reviewed baseline does not contain the expected ColumnPapiJo 1.17 chapter declaration.');
}
chapterLibrary.options = ['H5P.ColumnPapiJo 1.19'];
const semantics = JSON.parse(fs.readFileSync(path.join(root, 'semantics.json'), 'utf8'));
if (JSON.stringify(semantics) !== JSON.stringify(expectedSemantics)) {
  throw new Error('semantics.json differs beyond the reviewed ColumnPapiJo 1.17 to 1.19 update.');
}

const iconHash = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'icon.svg')))
  .digest('hex');
if (iconHash !== expectedReleaseIconSha256) {
  throw new Error(`icon.svg does not match the reviewed release icon (${iconHash}).`);
}

console.log(`Production immutability validation passed against ${baseline} (${protectedFiles.length} protected files plus the reviewed semantics update).`);
console.log(`Reviewed release icon SHA-256: ${iconHash.toUpperCase()}`);
