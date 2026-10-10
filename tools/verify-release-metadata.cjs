'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const baseline = 'v1.16.0';
const root = path.resolve(__dirname, '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const semantics = JSON.parse(fs.readFileSync(path.join(root, 'semantics.json'), 'utf8'));
const baselineLibrary = JSON.parse(execFileSync(
  'git',
  ['show', `${baseline}:library.json`],
  { cwd: root, encoding: 'utf8' }
));

const version = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
const baselineSemantics = JSON.parse(execFileSync(
  'git',
  ['show', `${baseline}:semantics.json`],
  { cwd: root, encoding: 'utf8' }
));
const expectedVersion = '1.17.0';

if (version !== expectedVersion) {
  throw new Error(`Expected compatibility release ${expectedVersion}, found ${version}.`);
}
if (packageMetadata.version !== version) {
  throw new Error(`package.json version ${packageMetadata.version} does not match library version ${version}.`);
}
if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  throw new Error('package-lock.json root versions do not match the H5P library version.');
}
if (packageMetadata.private !== true) {
  throw new Error('The npm package must remain private because it is release tooling, not a published npm artifact.');
}

const expectedLibrary = structuredClone(baselineLibrary);
expectedLibrary.minorVersion = 17;
expectedLibrary.patchVersion = 0;
const expectedColumn = expectedLibrary.preloadedDependencies.find(
  (dependency) => dependency.machineName === 'H5P.ColumnPapiJo'
);
if (!expectedColumn) {
  throw new Error('The reviewed baseline does not contain H5P.ColumnPapiJo.');
}
if (expectedColumn.majorVersion !== 1 || expectedColumn.minorVersion !== 20) {
  throw new Error('The published v1.16.0 baseline does not require H5P.ColumnPapiJo 1.20.');
}
expectedColumn.minorVersion = 21;
if (JSON.stringify(library) !== JSON.stringify(expectedLibrary)) {
  throw new Error('library.json differs beyond the reviewed 1.17.0 and ColumnPapiJo 1.21 changes.');
}

const directDependencies = ['preloadedDependencies', 'editorDependencies', 'dynamicDependencies']
  .flatMap((section) => library[section] || []);
for (const machineName of ['H5P.AccordionPapiJo', 'H5P.AdvancedTextPapiJo', 'H5P.QuestionSetPapiJo', 'H5P.ScaleQuestion']) {
  if (directDependencies.some((dependency) => dependency.machineName === machineName)) {
    throw new Error(`Unexpected direct Interactive Book dependency: ${machineName}.`);
  }
}

const expectedSemantics = structuredClone(baselineSemantics);
const baselineChapterLibrary = expectedSemantics
  .find((field) => field.name === 'chapters')
  ?.field.fields.find((field) => field.name === 'chapter');
if (!baselineChapterLibrary ||
    JSON.stringify(baselineChapterLibrary.options) !== JSON.stringify(['H5P.ColumnPapiJo 1.20'])) {
  throw new Error('The published v1.16.0 baseline does not author chapters with ColumnPapiJo 1.20.');
}
baselineChapterLibrary.options = ['H5P.ColumnPapiJo 1.21'];
if (JSON.stringify(semantics) !== JSON.stringify(expectedSemantics)) {
  throw new Error('semantics.json differs beyond the reviewed ColumnPapiJo 1.20 to 1.21 change.');
}
if (JSON.stringify(semantics).includes('H5P.ColumnPapiJo 1.20')) {
  throw new Error('semantics.json still contains the old ColumnPapiJo 1.20 authoring declaration.');
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
if (!readme.includes(`Current release: **${version}**`)) {
  throw new Error(`README.md does not identify release ${version}.`);
}
if (!changelog.includes(`## ${version} - `)) {
  throw new Error(`CHANGELOG.md has no ${version} release section.`);
}

console.log(`Release metadata validation passed for ${library.machineName} ${version}.`);
