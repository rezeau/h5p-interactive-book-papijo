'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const h5pJsCandidates = [
  process.env.H5P_CORE_JS_PATH,
  'C:\\wamp64\\www\\wp-h5p\\wp-content\\plugins\\h5p\\h5p-php-library\\js',
].filter(Boolean);
const columnCandidates = [
  process.env.H5P_COLUMN_PAPIJO_119_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-column'),
].filter(Boolean);
const questionSetCandidates = [
  process.env.H5P_QUESTIONSET_PAPIJO_122_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-questionset'),
  'C:\\wamp64\\www\\wp-h5p\\wp-content\\uploads\\h5p\\libraries\\H5P.QuestionSetPapiJo-1.22',
].filter(Boolean);

const h5pJsPath = h5pJsCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'h5p-version.js')) &&
  fs.existsSync(path.join(candidate, 'h5p-content-upgrade-process.js'))
);
const columnPath = columnCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'library.json')) &&
  fs.existsSync(path.join(candidate, 'semantics.json'))
);
const questionSetPath = questionSetCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'library.json')) &&
  fs.existsSync(path.join(candidate, 'semantics.json'))
);

test(
  'real H5P recursion upgrades InteractiveBook 1.14 -> 1.15, ColumnPapiJo 1.17 -> 1.19, and QuestionSetPapiJo 1.21 -> 1.22.1',
  {
    skip: !h5pJsPath || !columnPath || !questionSetPath
      ? 'H5P core upgrade scripts or target PapiJo libraries are unavailable'
      : false,
  },
  async () => {
    const fixture = JSON.parse(fs.readFileSync(
      path.join(root, 'tests', 'fixtures', 'interactivebook-1.14-column-1.17-questionset-1.21.json'),
      'utf8'
    ));
    const before = structuredClone(fixture);
    const chapterBefore = fixture.params.chapters[0];
    const questionSetBefore = chapterBefore.params.content[0].content;
    const expectedChapterParams = structuredClone(chapterBefore.params);
    expectedChapterParams.content[0].content.library = 'H5P.QuestionSetPapiJo 1.22';
    const questionSetParamsBefore = structuredClone(questionSetBefore.params);

    assert.equal(fixture.library, 'H5P.InteractiveBookPapiJo 1.14');
    assert.equal(chapterBefore.library, 'H5P.ColumnPapiJo 1.17');
    assert.equal(questionSetBefore.library, 'H5P.QuestionSetPapiJo 1.21');

    const context = vm.createContext({ H5P: {}, H5PUpgrades: {}, console, setTimeout });
    vm.runInContext(
      fs.readFileSync(path.join(h5pJsPath, 'h5p-version.js'), 'utf8'),
      context,
      { filename: 'h5p-version.js' }
    );
    vm.runInContext(
      fs.readFileSync(path.join(h5pJsPath, 'h5p-content-upgrade-process.js'), 'utf8'),
      context,
      { filename: 'h5p-content-upgrade-process.js' }
    );

    const interactiveBookSemantics = JSON.parse(fs.readFileSync(path.join(root, 'semantics.json'), 'utf8'));
    const chapterField = interactiveBookSemantics
      .find((field) => field.name === 'chapters')
      .field.fields.find((field) => field.name === 'chapter');
    assert.deepEqual(chapterField.options, ['H5P.ColumnPapiJo 1.19']);

    const columnLibrary = JSON.parse(fs.readFileSync(path.join(columnPath, 'library.json'), 'utf8'));
    const columnSemantics = JSON.parse(fs.readFileSync(path.join(columnPath, 'semantics.json'), 'utf8'));
    const questionSetLibrary = JSON.parse(fs.readFileSync(path.join(questionSetPath, 'library.json'), 'utf8'));
    const questionSetSemantics = JSON.parse(fs.readFileSync(path.join(questionSetPath, 'semantics.json'), 'utf8'));

    assert.deepEqual(
      [columnLibrary.machineName, columnLibrary.majorVersion, columnLibrary.minorVersion, columnLibrary.patchVersion],
      ['H5P.ColumnPapiJo', 1, 19, 0]
    );
    assert.deepEqual(
      [questionSetLibrary.machineName, questionSetLibrary.majorVersion, questionSetLibrary.minorVersion, questionSetLibrary.patchVersion],
      ['H5P.QuestionSetPapiJo', 1, 22, 1]
    );

    const libraries = new Map([
      ['H5P.InteractiveBookPapiJo 1.15', {
        name: 'H5P.InteractiveBookPapiJo',
        semantics: interactiveBookSemantics,
      }],
      ['H5P.ColumnPapiJo 1.19', { name: 'H5P.ColumnPapiJo', semantics: columnSemantics }],
      ['H5P.QuestionSetPapiJo 1.22', {
        name: 'H5P.QuestionSetPapiJo',
        semantics: questionSetSemantics,
      }],
    ]);
    const loadLibrary = (name, version, done) => {
      const library = libraries.get(`${name} ${version.major}.${version.minor}`);
      setTimeout(() => done(library ? null : { type: 'libraryMissing', library: name }, library), 0);
    };

    const result = await new Promise((resolve, reject) => {
      new context.H5P.ContentUpgradeProcess(
        'H5P.InteractiveBookPapiJo',
        new context.H5P.Version('1.14'),
        new context.H5P.Version('1.15'),
        JSON.stringify({ params: fixture.params, metadata: {} }),
        'interactive-book-phase-2a',
        loadLibrary,
        (error, upgraded) => error ? reject(error) : resolve(JSON.parse(upgraded))
      );
    });

    const upgradedChapter = result.params.chapters[0];
    const upgradedQuestionSet = upgradedChapter.params.content[0].content;
    assert.deepEqual(fixture, before);
    assert.equal(upgradedChapter.library, 'H5P.ColumnPapiJo 1.19');
    assert.equal(upgradedQuestionSet.library, 'H5P.QuestionSetPapiJo 1.22');
    assert.deepEqual(upgradedChapter.params, expectedChapterParams);
    assert.deepEqual(upgradedQuestionSet.params, questionSetParamsBefore);
    assert.equal(fs.existsSync(path.join(root, 'upgrades.js')), false);
  }
);
