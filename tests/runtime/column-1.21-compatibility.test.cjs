'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { findLibrary } = require('./helpers/library-discovery.cjs');

const root = path.resolve(__dirname, '..', '..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const columnPath = findLibrary([
  process.env.H5P_COLUMN_PAPIJO_121_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-column'),
].filter(Boolean), {
  machineName: 'H5P.ColumnPapiJo', majorVersion: 1, minorVersion: 21, patchVersion: 0,
}, ['semantics.json']);
const childPath = findLibrary([
  process.env.H5P_ADVANCEDTEXT_PAPIJO_126_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-advancedtext'),
].filter(Boolean), {
  machineName: 'H5P.AdvancedTextPapiJo', majorVersion: 1, minorVersion: 2, patchVersion: 6,
}, ['semantics.json']);
const corePhpPath = process.env.H5P_CORE_PHP_PATH ||
  'C:/wamp64/www/wp-h5p/wp-content/plugins/h5p/h5p-php-library/h5p.classes.php';
const coreJsPath = process.env.H5P_CORE_JS_PATH ||
  'C:/wamp64/www/wp-h5p/wp-content/plugins/h5p/h5p-php-library/js';
const php = process.env.H5P_PHP_BINARY || 'php';
const readBaseline = (file) => JSON.parse(execFileSync('git', ['show', `v1.16.0:${file}`], {
  cwd: root, encoding: 'utf8',
}));
const dependency = (machineName, minorVersion, type = 'preloaded') => ({
  machineName, majorVersion: 1, minorVersion, type,
});

function makeContent() {
  return {
    library: 'H5P.InteractiveBookPapiJo 1.17',
    metadata: { title: 'Book fixture', license: 'U' },
    params: {
      showCoverPage: false,
      unknownBookField: 'remove',
      chapters: [{
        library: 'H5P.ColumnPapiJo 1.21',
        subContentId: 'f62cce2e-5a86-4edb-8a42-f1ec7b777cc1',
        metadata: { title: 'Page fixture', license: 'U' },
        unknownPageAttribute: 'remove',
        params: {
          unknownColumnField: 'remove',
          content: [{
            content: {
              library: 'H5P.AdvancedTextPapiJo 1.3',
              subContentId: '8539affc-ef27-475e-9b64-562e52d19210',
              unknownChildAttribute: 'remove',
              params: {
                text: '<p onclick="alert(1)">Kept <strong>formatted</strong><script>alert(2)</script></p>',
                tooltipImages: [], inlineImages: [], unknownChildField: 'remove',
              },
              metadata: { title: 'Prospective text', license: 'U', unknownMetadata: 'remove' },
            },
            useSeparator: 'auto', unknownEntryField: 'remove',
          }],
        },
      }],
    },
  };
}

test('real PHP H5P validation preserves Column 1.21, filters fields, traverses dependencies, and rejects old page semantics', {
  skip: !columnPath || !fs.existsSync(corePhpPath) ? 'Prepared Column 1.21 or installed H5P PHP core unavailable' : false,
}, () => {
  const input = {
    corePath: corePhpPath,
    bookLibrary: readJson(path.join(root, 'library.json')),
    bookSemantics: readJson(path.join(root, 'semantics.json')),
    oldBookLibrary: readBaseline('library.json'),
    oldBookSemantics: readBaseline('semantics.json'),
    columnLibrary: readJson(path.join(columnPath, 'library.json')),
    columnSemantics: readJson(path.join(columnPath, 'semantics.json')),
    oldColumnLibrary: JSON.parse(execFileSync('git', ['-C', columnPath, 'show', 'v1.20.0:library.json'], {
      encoding: 'utf8',
    })),
    libraryRoots: [process.env.H5P_LIBRARY_ROOT,
      'C:/my_first_h5p_environment/libraries',
      'C:/wamp64/www/wp-h5p/wp-content/uploads/h5p/libraries',
    ].filter(Boolean),
    content: makeContent(),
  };
  if (childPath) {
    input.childLibrary = readJson(path.join(childPath, 'library.json'));
    input.childSemantics = readJson(path.join(childPath, 'semantics.json'));
  }
  const result = JSON.parse(execFileSync(php, [path.join(__dirname, 'helpers', 'column-1.21-validator.php')], {
    cwd: root, input: JSON.stringify(input), encoding: 'utf8',
  }));
  assert.equal(path.resolve(result.validatorPath), path.resolve(corePhpPath));
  assert.equal(path.resolve(result.dependencyTraversalPath), path.resolve(corePhpPath));
  const page = result.columnOnly.content.params.chapters[0];
  assert.ok(page, 'Column page must survive recursive validation');
  assert.equal(page.library, 'H5P.ColumnPapiJo 1.21');
  assert.equal(result.columnOnly.directPage.library, page.library);
  assert.equal(page.subContentId, input.content.params.chapters[0].subContentId);
  assert.equal(page.metadata.title, 'Page fixture');
  assert.equal(Object.hasOwn(result.columnOnly.content.params, 'unknownBookField'), false);
  assert.equal(Object.hasOwn(page, 'unknownPageAttribute'), false);
  assert.equal(Object.hasOwn(page.params, 'unknownColumnField'), false);
  assert.deepEqual(result.columnOnly.errors, []);
  assert.ok(result.columnOnly.dependencies.some((item) =>
    JSON.stringify(item) === JSON.stringify(dependency('H5P.ColumnPapiJo', 21))));
  assert.equal(result.old.directPage, null);
  // H5P removes rejected list entries and then the resulting empty list.
  assert.equal(Object.hasOwn(result.old.content.params, 'chapters'), false);
  assert.ok(result.old.errors.some(({ message }) =>
    message.includes('H5P.ColumnPapiJo 1.21') && message.includes('H5P.ColumnPapiJo 1.20')));
  assert.equal(result.old.dependencies.some((item) =>
    item.machineName === 'H5P.ColumnPapiJo' && item.minorVersion === 21), false);
  assert.ok(result.old.dependencies.some((item) =>
    JSON.stringify(item) === JSON.stringify(dependency('H5P.ColumnPapiJo', 20))));
  console.log('Real PHP validator/core: Column 1.21 survives; normal filtering active; Column 1.21 preloaded; old 1.16 page semantics reject 1.21 as null.');
  if (!childPath) {
    console.log('Prospective nested validation unavailable: unchanged AdvancedTextPapiJo 1.2.6 sources missing.');
    return;
  }
  const nestedPage = result.nested.content.params.chapters[0];
  const entry = nestedPage.params.content[0];
  const child = entry.content;
  assert.equal(nestedPage.library, 'H5P.ColumnPapiJo 1.21');
  assert.equal(child.library, 'H5P.AdvancedTextPapiJo 1.3');
  assert.equal(child.subContentId, input.content.params.chapters[0].params.content[0].content.subContentId);
  assert.equal(child.metadata.title, 'Prospective text');
  assert.equal(entry.useSeparator, 'auto');
  assert.match(child.params.text, /Kept <strong>formatted<\/strong>/);
  assert.doesNotMatch(child.params.text, /onclick|<script/i);
  for (const [object, key] of [
    [result.nested.content.params, 'unknownBookField'], [nestedPage, 'unknownPageAttribute'],
    [nestedPage.params, 'unknownColumnField'], [entry, 'unknownEntryField'],
    [child, 'unknownChildAttribute'], [child.params, 'unknownChildField'], [child.metadata, 'unknownMetadata'],
  ]) {
    assert.equal(Object.hasOwn(object, key), false, key);
  }
  assert.deepEqual(result.nested.errors, []);
  for (const expected of [dependency('H5P.InteractiveBookPapiJo', 17),
    dependency('H5P.ColumnPapiJo', 21), dependency('H5P.AdvancedTextPapiJo', 3),
    dependency('H5PEditor.AdvancedTextPapiJoTooltip', 1, 'editor')]) {
    assert.ok(result.nested.dependencies.some((item) => JSON.stringify(item) === JSON.stringify(expected)),
      JSON.stringify(expected));
  }
  assert.equal(result.sourceChildVersion, '1.2.6');
  assert.equal(result.registrationOnlyVersion, '1.3.0');
  console.log('Prospective recursive PHP validation: Book 1.17 -> real Column 1.21 -> AdvancedText 1.3 registration survives, including HTML filtering and editor dependency traversal; child sources remain 1.2.6.');
});

for (const [bookMinor, columnMinor] of [[14, 17], [15, 19], [16, 20]]) {
  for (const prospective of [false, true]) {
    test(`real H5P upgrade Book 1.${bookMinor} / Column 1.${columnMinor} -> Book 1.17 / Column 1.21${prospective ? ' / prospective AdvancedText 1.3' : ' preserving existing children'}`, {
      skip: !columnPath || !fs.existsSync(path.join(coreJsPath, 'h5p-content-upgrade-process.js')) ||
        (prospective && !childPath) ? 'Real H5P upgrade sources or required child sources unavailable' : false,
    }, async () => {
      const context = vm.createContext({ H5P: {}, H5PUpgrades: {}, console, setTimeout });
      for (const file of ['h5p-version.js', 'h5p-content-upgrade-process.js']) {
        vm.runInContext(fs.readFileSync(path.join(coreJsPath, file), 'utf8'), context, { filename: file });
      }
      const first = makeContent().params.chapters[0];
      delete first.unknownPageAttribute;
      delete first.params.unknownColumnField;
      const child = first.params.content[0].content;
      delete child.unknownChildAttribute;
      delete child.params.unknownChildField;
      delete child.metadata.unknownMetadata;
      delete first.params.content[0].unknownEntryField;
      child.params.text = '<p>Preserved text.</p>';
      child.library = prospective ? 'H5P.AdvancedTextPapiJo 1.2' : 'H5P.AdvancedText 1.1';
      const second = structuredClone(first);
      second.subContentId = 'ecf67572-d4b2-4f36-8683-6c930f0625b0';
      second.metadata.title = 'Second page';
      second.params.content[0].content.library = 'H5P.AdvancedText 1.1';
      second.params.content[0].content.subContentId = 'd0931cc3-8a81-45fd-a62e-639cb54ddc67';
      const params = { showCoverPage: false, chapters: [first, second], behaviour: { baseColor: '#1768c4' } };
      params.chapters.forEach((page) => { page.library = `H5P.ColumnPapiJo 1.${columnMinor}`; });
      const metadata = { title: 'Preserved book metadata', license: 'U', defaultLanguage: 'fr' };
      const before = structuredClone({ params, metadata });
      const libraries = new Map([
        ['H5P.InteractiveBookPapiJo 1.17', { name: 'H5P.InteractiveBookPapiJo', semantics: readJson(path.join(root, 'semantics.json')) }],
        ['H5P.ColumnPapiJo 1.21', { name: 'H5P.ColumnPapiJo', semantics: readJson(path.join(columnPath, 'semantics.json')) }],
      ]);
      if (prospective) {
        // Registration only: never materialize a version-bumped child library.
        libraries.set('H5P.AdvancedTextPapiJo 1.3', {
          name: 'H5P.AdvancedTextPapiJo', semantics: readJson(path.join(childPath, 'semantics.json')),
        });
      }
      const requests = [];
      const loadLibrary = (name, version, done) => {
        const key = `${name} ${version.major}.${version.minor}`;
        requests.push(key);
        const library = libraries.get(key);
        setTimeout(() => done(library ? null : { type: 'libraryMissing', library: key }, library), 0);
      };
      const result = await new Promise((resolve, reject) => {
        new context.H5P.ContentUpgradeProcess('H5P.InteractiveBookPapiJo',
          new context.H5P.Version(`1.${bookMinor}`), new context.H5P.Version('1.17'),
          JSON.stringify({ params, metadata }), `column-1.21-upgrade-${bookMinor}`, loadLibrary,
          (error, upgraded) => error ? reject(error) : resolve(JSON.parse(upgraded)));
      });
      const expected = structuredClone(before);
      expected.params.chapters.forEach((page) => { page.library = 'H5P.ColumnPapiJo 1.21'; });
      if (prospective) {
        expected.params.chapters[0].params.content[0].content.library = 'H5P.AdvancedTextPapiJo 1.3';
      }
      assert.deepEqual(result, expected, 'Only requested library references may change; chapter order, data and metadata survive');
      assert.deepEqual({ params, metadata }, before);
      assert.deepEqual(requests, ['H5P.InteractiveBookPapiJo 1.17', 'H5P.ColumnPapiJo 1.21',
        ...(prospective ? ['H5P.AdvancedTextPapiJo 1.3'] : []), 'H5P.ColumnPapiJo 1.21']);
      assert.equal(fs.existsSync(path.join(root, 'upgrades.js')), false);
    });
  }
}
