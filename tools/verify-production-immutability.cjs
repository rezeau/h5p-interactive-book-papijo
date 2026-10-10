'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const baseline = 'v1.16.0';
const root = path.resolve(__dirname, '..');
const protectedPaths = [
  '.h5pignore',
  'LICENSE',
  'icon.svg',
  'language',
  'src',
  'webpack.config.js',
];
const reviewedDistributionSha256 = {
  'dist/00f1d21bbce2734619cf.woff': 'c6a4083eef63bf1f35d5bfdf7b29a4b14019b51500471b5535fd0db98d582f6a',
  'dist/3fbecededfe43dabfbb2.ttf': '8608086372867e2ef63d00b139c25b051447c9648c5b340d4dbd50d15dc874f0',
  'dist/8dc8cf1d96ae9353dbac.eot': 'a9c540d1ab7f42e11388c622887698110ffc15d8ac18a1372aee469f88584a20',
  'dist/c15cb97e9d7a5ebe0220.svg': '19ca5f58ca29a113e9bfc34b1414996421af963078e7b944aa704d6c049c42c1',
  'dist/h5p-interactive-book-papijo.css': '8a97ccfc40b6fe952b4a86f60fb78251cf2736eae3d61289bb70a79f8e94dfd1',
  'dist/h5p-interactive-book-papijo.js': '29fc26af702a1713bdd07c41ca9e42ec0435cbd530ff151428ce49d9f3f52225',
  'dist/h5p-interactive-book-papijo.js.LICENSE.txt': '65cc1f740fa67182957827a41f2f0d87e389f56a23fe0462ea2bf234a7bdfaf7',
};

function listWorkingFiles(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  if (fs.statSync(fullPath).isFile()) {
    return [relativePath.replaceAll('\\', '/')];
  }

  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) =>
    listWorkingFiles(path.join(relativePath, entry.name))
  );
}

const baselineProtectedFiles = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', baseline, '--', ...protectedPaths],
  { cwd: root, encoding: 'utf8' }
).trim().split(/\r?\n/).filter(Boolean);
const workingProtectedFiles = protectedPaths.flatMap(listWorkingFiles).sort();
const protectedFiles = [...new Set([...baselineProtectedFiles, ...workingProtectedFiles])].sort();
const baselineFileSet = new Set(baselineProtectedFiles);
const workingFileSet = new Set(workingProtectedFiles);
const changed = [];

for (const file of protectedFiles) {
  if (!baselineFileSet.has(file) || !workingFileSet.has(file)) {
    changed.push(file);
    continue;
  }
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

const distributionFiles = listWorkingFiles('dist').sort();
const expectedDistributionFiles = Object.keys(reviewedDistributionSha256).sort();
if (JSON.stringify(distributionFiles) !== JSON.stringify(expectedDistributionFiles)) {
  throw new Error('Compiled distribution file set differs from the reviewed v1.15.0 release assets.');
}
const changedDistributionFiles = distributionFiles.filter((file) => {
  const hash = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, file)))
    .digest('hex');
  return hash !== reviewedDistributionSha256[file];
});
if (changedDistributionFiles.length > 0) {
  throw new Error(`Compiled distribution files differ from reviewed v1.15.0 assets: ${changedDistributionFiles.join(', ')}`);
}

for (const unexpectedFile of ['upgrades.js', 'presave.js']) {
  if (fs.existsSync(path.join(root, unexpectedFile))) {
    throw new Error(`Unexpected production file for this metadata-only release: ${unexpectedFile}`);
  }
}

const baselineLibrary = JSON.parse(execFileSync(
  'git',
  ['show', `${baseline}:library.json`],
  { cwd: root, encoding: 'utf8' }
));
const expectedLibrary = structuredClone(baselineLibrary);
if (expectedLibrary.majorVersion !== 1 || expectedLibrary.minorVersion !== 16 ||
    expectedLibrary.patchVersion !== 0) {
  throw new Error('The published baseline is not H5P.InteractiveBookPapiJo 1.16.0.');
}
expectedLibrary.minorVersion = 17;
const expectedColumn = expectedLibrary.preloadedDependencies.find(
  (dependency) => dependency.machineName === 'H5P.ColumnPapiJo'
);
if (!expectedColumn || expectedColumn.majorVersion !== 1 || expectedColumn.minorVersion !== 20) {
  throw new Error('The published v1.16.0 baseline does not require H5P.ColumnPapiJo 1.20.');
}
expectedColumn.minorVersion = 21;
const library = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
if (JSON.stringify(library) !== JSON.stringify(expectedLibrary)) {
  throw new Error('library.json differs beyond the approved 1.16 to 1.17 and ColumnPapiJo 1.20 to 1.21 changes.');
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
if (!chapterLibrary || JSON.stringify(chapterLibrary.options) !==
    JSON.stringify(['H5P.ColumnPapiJo 1.20'])) {
  throw new Error('The published v1.16.0 baseline does not author chapters with ColumnPapiJo 1.20.');
}
chapterLibrary.options = ['H5P.ColumnPapiJo 1.21'];
const semantics = JSON.parse(fs.readFileSync(path.join(root, 'semantics.json'), 'utf8'));
if (JSON.stringify(semantics) !== JSON.stringify(expectedSemantics)) {
  throw new Error('semantics.json differs beyond the approved ColumnPapiJo 1.20 to 1.21 change.');
}

const iconHash = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'icon.svg')))
  .digest('hex');
console.log(`Production validation passed against ${baseline} (${protectedFiles.length} byte-identical tracked files, ${distributionFiles.length} reviewed compiled assets, plus the three approved metadata changes).`);
console.log(`Release icon SHA-256: ${iconHash.toUpperCase()}`);
