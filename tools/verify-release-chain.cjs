'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const repairedColumn = 'dd1f5596063127e493494102606d97f0065ef1bf';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = (manifest) => [manifest.machineName, manifest.majorVersion,
  manifest.minorVersion, manifest.patchVersion];
const options = (semantics) => semantics.flatMap(function visit(field) {
  return [...(field.type === 'library' ? field.options : []),
    ...(field.fields || []).flatMap(visit), ...(field.field ? visit(field.field) : [])];
});

function candidate(directory, name, version, hasSemantics = true) {
  // One explicit source, read verbatim. Missing/mismatched sources fail; no discovery,
  // version rewriting, historical snapshots, or installed-library fallback.
  const manifest = readJson(path.join(directory, 'library.json'));
  assert.deepEqual(identity(manifest), [name, ...version], `Actual candidate required: ${directory}`);
  for (const asset of [...(manifest.preloadedJs || []), ...(manifest.preloadedCss || [])]) {
    assert.ok(fs.existsSync(path.join(directory, asset.path)), `Missing candidate asset: ${asset.path}`);
  }
  return { directory, manifest,
    semantics: hasSemantics ? readJson(path.join(directory, 'semantics.json')) : [] };
}

function assertChain(chain) {
  for (const [key, name, version] of [
    ['book', 'H5P.InteractiveBookPapiJo', [1, 17, 0]],
    ['column', 'H5P.ColumnPapiJo', [1, 21, 0]],
    ['accordion', 'H5P.AccordionPapiJo', [1, 2, 0]],
    ['advanced', 'H5P.AdvancedTextPapiJo', [1, 3, 0]],
    ['editor', 'H5PEditor.AdvancedTextPapiJoTooltip', [1, 2, 0]],
  ]) assert.deepEqual(identity(chain[key].manifest), [name, ...version], key);
  assert.equal(chain.column.head, repairedColumn, 'Column must be the final repaired commit');
  assert.equal(chain.column.status, '', 'Column candidate must be clean, including its index');
  assert.deepEqual(options(chain.book.semantics).filter((v) => v.startsWith('H5P.ColumnPapiJo ')),
    ['H5P.ColumnPapiJo 1.21']);
  assert.deepEqual(chain.book.manifest.preloadedDependencies.find((d) => d.machineName === 'H5P.ColumnPapiJo'),
    { machineName: 'H5P.ColumnPapiJo', majorVersion: 1, minorVersion: 21 });
  const columnOptions = options(chain.column.semantics);
  for (const [name, minor] of [['H5P.AdvancedTextPapiJo', 3], ['H5P.AccordionPapiJo', 2]]) {
    assert.deepEqual(columnOptions.filter((v) => v.startsWith(`${name} `)), [`${name} 1.${minor}`]);
  }
  assert.deepEqual(options(chain.accordion.semantics).filter((v) => v.startsWith('H5P.AdvancedTextPapiJo ')),
    ['H5P.AdvancedTextPapiJo 1.3']);
  assert.deepEqual(chain.advanced.manifest.editorDependencies, [{
    machineName: 'H5PEditor.AdvancedTextPapiJoTooltip', majorVersion: 1, minorVersion: 2,
  }]);
  for (const name of ['H5P.AccordionPapiJo', 'H5P.AdvancedTextPapiJo']) {
    for (const section of ['preloadedDependencies', 'editorDependencies', 'dynamicDependencies']) {
      assert.ok(!(chain.book.manifest[section] || []).some((d) => d.machineName === name),
        `Unexpected direct Book dependency: ${name}`);
    }
  }
  for (const { directory } of Object.values(chain)) {
    assert.equal(fs.existsSync(path.join(directory, 'upgrades.js')), false,
      `A new upgrade script requires explicit audit/loading: ${directory}`);
  }
  return chain;
}

function loadCandidates() {
  const book = candidate(root, 'H5P.InteractiveBookPapiJo', [1, 17, 0]);
  const column = candidate(process.env.H5P_COLUMN_PAPIJO_121_PATH ||
    path.resolve(root, '../papi-jo-h5p-column'), 'H5P.ColumnPapiJo', [1, 21, 0]);
  column.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: column.directory, encoding: 'utf8' }).trim();
  column.status = execFileSync('git', ['status', '--porcelain=v1'], { cwd: column.directory, encoding: 'utf8' }).trim();
  const accordion = candidate(process.env.H5P_ACCORDION_PAPIJO_12_PATH ||
    path.resolve(root, '../papi-jo-h5p-accordion'), 'H5P.AccordionPapiJo', [1, 2, 0]);
  const advanced = candidate(process.env.H5P_ADVANCEDTEXT_PAPIJO_13_PATH ||
    path.resolve(root, '../papi-jo-h5p-advancedtext'), 'H5P.AdvancedTextPapiJo', [1, 3, 0]);
  const editor = candidate(process.env.H5P_ADVANCEDTEXT_PAPIJO_EDITOR_12_PATH ||
    path.join(advanced.directory, 'editor'), 'H5PEditor.AdvancedTextPapiJoTooltip', [1, 2, 0], false);
  return assertChain({ book, column, accordion, advanced, editor });
}

function assertPackageColumn(directory, chain) {
  const files = ['library.json', 'semantics.json',
    ...(chain.column.manifest.preloadedJs || []).map((a) => a.path),
    ...(chain.column.manifest.preloadedCss || []).map((a) => a.path)];
  for (const file of files) {
    assert.ok(fs.readFileSync(path.join(directory, file)).equals(
      fs.readFileSync(path.join(chain.column.directory, file))),
    `Packaging source differs from the repaired Column candidate: ${file}`);
  }
}

if (require.main === module) {
  const chain = loadCandidates();
  const args = process.argv.slice(2);
  if (args.length) {
    assert.equal(args.length, 2);
    assert.equal(args[0], '--library-root');
    assertPackageColumn(path.join(args[1], 'H5P.ColumnPapiJo-1.21'), chain);
  }
  console.log(`Actual release chain verified; repaired Column ${chain.column.head}; no fallback sources.`);
}
module.exports = { root, repairedColumn, readJson, candidate, assertChain, loadCandidates, assertPackageColumn };
