'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const baseline = '70f3b6a211bf79491bf00f965fbbc57593289910';
const root = path.resolve(__dirname, '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const baselineLibrary = JSON.parse(execFileSync(
  'git',
  ['show', `${baseline}:library.json`],
  { cwd: root, encoding: 'utf8' }
));

const version = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
const expectedVersion = '1.15.0';

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
expectedLibrary.minorVersion = 15;
expectedLibrary.patchVersion = 0;
const expectedColumn = expectedLibrary.preloadedDependencies.find(
  (dependency) => dependency.machineName === 'H5P.ColumnPapiJo'
);
if (!expectedColumn) {
  throw new Error('The reviewed baseline does not contain H5P.ColumnPapiJo.');
}
expectedColumn.minorVersion = 19;
if (JSON.stringify(library) !== JSON.stringify(expectedLibrary)) {
  throw new Error('library.json differs beyond the reviewed 1.15.0 and ColumnPapiJo 1.19 changes.');
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
