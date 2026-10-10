'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { findLibrary, materializeGitLibrary } = require('./helpers/library-discovery.cjs');

const root = path.resolve(__dirname, '..', '..');
const h5pJsCandidates = [
  process.env.H5P_CORE_JS_PATH,
  'C:\\wamp64\\www\\wp-h5p\\wp-content\\plugins\\h5p\\h5p-php-library\\js',
].filter(Boolean);
const columnCandidates = [
  process.env.H5P_COLUMN_PAPIJO_119_PATH,
  'C:\\wamp64\\www\\wp-h5p\\wp-content\\uploads\\h5p\\libraries\\H5P.ColumnPapiJo-1.19',
  'C:\\my_first_h5p_environment\\libraries\\H5P.ColumnPapiJo-1.19',
  path.resolve(root, '..', 'papi-jo-h5p-column'),
].filter(Boolean);
const questionSetCandidates = [
  process.env.H5P_QUESTIONSET_PAPIJO_1221_PATH,
  process.env.H5P_QUESTIONSET_PAPIJO_122_PATH,
  'C:\\wamp64\\www\\wp-h5p\\wp-content\\uploads\\h5p\\libraries\\H5P.QuestionSetPapiJo-1.22',
  'C:\\my_first_h5p_environment\\libraries\\H5P.QuestionSetPapiJo-1.22',
  path.resolve(root, '..', 'papi-jo-h5p-questionset'),
].filter(Boolean);
const column120Candidates = [
  process.env.H5P_COLUMN_PAPIJO_120_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-column'),
  'C:\\my_first_h5p_environment\\libraries\\H5P.ColumnPapiJo-1.20',
].filter(Boolean);
const questionSet123Candidates = [
  process.env.H5P_QUESTIONSET_PAPIJO_123_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-questionset'),
  'C:\\my_first_h5p_environment\\libraries\\H5P.QuestionSetPapiJo-1.23',
].filter(Boolean);
const scaleQuestion02Candidates = [
  process.env.H5P_SCALEQUESTION_02_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-scale-question'),
  'C:\\my_first_h5p_environment\\libraries\\H5P.ScaleQuestion-0.2',
].filter(Boolean);

const h5pJsPath = h5pJsCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'h5p-version.js')) &&
  fs.existsSync(path.join(candidate, 'h5p-content-upgrade-process.js'))
);
const columnPath = findLibrary(columnCandidates, {
  machineName: 'H5P.ColumnPapiJo',
  majorVersion: 1,
  minorVersion: 19,
  patchVersion: 0,
}, ['semantics.json']);
let questionSetPath = findLibrary(questionSetCandidates, {
  machineName: 'H5P.QuestionSetPapiJo',
  majorVersion: 1,
  minorVersion: 22,
  patchVersion: 1,
}, ['semantics.json']);
const questionSetSnapshot = questionSetPath ? undefined : materializeGitLibrary([
  process.env.H5P_QUESTIONSET_PAPIJO_REPOSITORY,
  path.resolve(root, '..', 'papi-jo-h5p-questionset'),
].filter(Boolean), 'v1.22.1', {
  machineName: 'H5P.QuestionSetPapiJo',
  majorVersion: 1,
  minorVersion: 22,
  patchVersion: 1,
}, ['semantics.json']);
if (questionSetSnapshot) {
  questionSetPath = questionSetSnapshot.path;
  test.after(() => questionSetSnapshot.cleanup());
}
const interactiveBook115Snapshot = materializeGitLibrary([root], 'v1.15.0', {
  machineName: 'H5P.InteractiveBookPapiJo',
  majorVersion: 1,
  minorVersion: 15,
  patchVersion: 0,
}, ['semantics.json']);
if (interactiveBook115Snapshot) {
  test.after(() => interactiveBook115Snapshot.cleanup());
}
const interactiveBook116Snapshot = materializeGitLibrary([root], 'v1.16.0', {
  machineName: 'H5P.InteractiveBookPapiJo',
  majorVersion: 1,
  minorVersion: 16,
  patchVersion: 0,
}, ['semantics.json']);
if (interactiveBook116Snapshot) {
  test.after(() => interactiveBook116Snapshot.cleanup());
}
let column120Path = findLibrary(column120Candidates, {
  machineName: 'H5P.ColumnPapiJo',
  majorVersion: 1,
  minorVersion: 20,
  patchVersion: 0,
}, ['semantics.json']);
const column120Snapshot = column120Path ? undefined : materializeGitLibrary([
  process.env.H5P_COLUMN_PAPIJO_REPOSITORY,
  path.resolve(root, '..', 'papi-jo-h5p-column'),
].filter(Boolean), 'v1.20.0', {
  machineName: 'H5P.ColumnPapiJo', majorVersion: 1, minorVersion: 20, patchVersion: 0,
}, ['semantics.json']);
if (column120Snapshot) {
  column120Path = column120Snapshot.path;
  test.after(() => column120Snapshot.cleanup());
}
const questionSet123Path = findLibrary(questionSet123Candidates, {
  machineName: 'H5P.QuestionSetPapiJo',
  majorVersion: 1,
  minorVersion: 23,
  patchVersion: 0,
}, ['semantics.json']);
let scaleQuestion02Path = findLibrary(scaleQuestion02Candidates, {
  machineName: 'H5P.ScaleQuestion',
  majorVersion: 0,
  minorVersion: 2,
  patchVersion: 1,
}, ['semantics.json', 'upgrades.js']);
const scaleQuestion021Snapshot = scaleQuestion02Path ? undefined : materializeGitLibrary([
  process.env.H5P_SCALEQUESTION_REPOSITORY,
  path.resolve(root, '..', 'papi-jo-h5p-scale-question'),
].filter(Boolean), 'v0.2.1', {
  machineName: 'H5P.ScaleQuestion', majorVersion: 0, minorVersion: 2, patchVersion: 1,
}, ['semantics.json', 'upgrades.js']);
if (scaleQuestion021Snapshot) {
  scaleQuestion02Path = scaleQuestion021Snapshot.path;
  test.after(() => scaleQuestion021Snapshot.cleanup());
}

test(
  'real H5P recursion upgrades InteractiveBook 1.14 -> 1.15, ColumnPapiJo 1.17 -> 1.19, and QuestionSetPapiJo 1.21 -> 1.22.1',
  {
    skip: !h5pJsPath || !interactiveBook115Snapshot || !columnPath || !questionSetPath
      ? 'H5P core, InteractiveBookPapiJo 1.15.0, ColumnPapiJo 1.19.0, or QuestionSetPapiJo 1.22.1 is unavailable'
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

    const interactiveBookSemantics = JSON.parse(fs.readFileSync(
      path.join(interactiveBook115Snapshot.path, 'semantics.json'),
      'utf8'
    ));
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

test(
  'real H5P recursion upgrades InteractiveBook 1.15 -> 1.16 through Column 1.20, QuestionSet 1.23, and ScaleQuestion 0.2',
  {
    skip: !h5pJsPath || !interactiveBook116Snapshot || !column120Path || !questionSet123Path || !scaleQuestion02Path
      ? 'H5P core, InteractiveBookPapiJo 1.16.0, ColumnPapiJo 1.20.0, QuestionSetPapiJo 1.23.0, or ScaleQuestion 0.2.1 is unavailable'
      : false,
  },
  async () => {
    const fixture = JSON.parse(fs.readFileSync(
      path.join(root, 'tests', 'fixtures', 'interactivebook-1.15-column-1.19-recursive-upgrade.json'),
      'utf8'
    ));
    const before = structuredClone(fixture);

    const destinationManifest = JSON.parse(fs.readFileSync(path.join(interactiveBook116Snapshot.path, 'library.json'), 'utf8'));
    const destinationColumnDependency = destinationManifest.preloadedDependencies.find(
      ({ machineName }) => machineName === 'H5P.ColumnPapiJo'
    );
    assert.deepEqual(
      [destinationManifest.machineName, destinationManifest.majorVersion,
        destinationManifest.minorVersion, destinationManifest.patchVersion],
      ['H5P.InteractiveBookPapiJo', 1, 16, 0]
    );
    assert.deepEqual(
      [destinationColumnDependency.majorVersion, destinationColumnDependency.minorVersion],
      [1, 20]
    );

    const destinationSemantics = JSON.parse(fs.readFileSync(path.join(interactiveBook116Snapshot.path, 'semantics.json'), 'utf8'));
    const destinationChapterField = destinationSemantics
      .find(({ name }) => name === 'chapters')
      .field.fields.find(({ name }) => name === 'chapter');
    assert.deepEqual(destinationChapterField.options, ['H5P.ColumnPapiJo 1.20']);

    const columnLibrary = JSON.parse(fs.readFileSync(path.join(column120Path, 'library.json'), 'utf8'));
    const questionSetLibrary = JSON.parse(fs.readFileSync(path.join(questionSet123Path, 'library.json'), 'utf8'));
    const scaleQuestionLibrary = JSON.parse(fs.readFileSync(path.join(scaleQuestion02Path, 'library.json'), 'utf8'));
    assert.deepEqual(
      [columnLibrary.machineName, columnLibrary.majorVersion, columnLibrary.minorVersion, columnLibrary.patchVersion],
      ['H5P.ColumnPapiJo', 1, 20, 0]
    );
    assert.deepEqual(
      [questionSetLibrary.machineName, questionSetLibrary.majorVersion, questionSetLibrary.minorVersion, questionSetLibrary.patchVersion],
      ['H5P.QuestionSetPapiJo', 1, 23, 0]
    );
    assert.deepEqual(
      [scaleQuestionLibrary.machineName, scaleQuestionLibrary.majorVersion, scaleQuestionLibrary.minorVersion, scaleQuestionLibrary.patchVersion],
      ['H5P.ScaleQuestion', 0, 2, 1]
    );

    const context = vm.createContext({ H5P: {}, H5PUpgrades: {}, console, setTimeout });
    for (const file of ['h5p-version.js', 'h5p-content-upgrade-process.js']) {
      vm.runInContext(
        fs.readFileSync(path.join(h5pJsPath, file), 'utf8'),
        context,
        { filename: file }
      );
    }
    const scaleUpgradesPath = path.join(scaleQuestion02Path, 'upgrades.js');
    vm.runInContext(
      fs.readFileSync(scaleUpgradesPath, 'utf8'),
      context,
      { filename: scaleUpgradesPath }
    );
    const scaleUpgrade = context.H5PUpgrades['H5P.ScaleQuestion'][0][2];
    assert.equal(typeof scaleUpgrade.contentUpgrade, 'function');
    const originalScaleUpgrade = scaleUpgrade.contentUpgrade;
    let scaleUpgradeCalls = 0;
    scaleUpgrade.contentUpgrade = function (parameters, finished, extras) {
      scaleUpgradeCalls++;
      return originalScaleUpgrade(parameters, finished, extras);
    };

    const libraries = new Map([
      ['H5P.InteractiveBookPapiJo 1.16', {
        name: destinationManifest.machineName,
        semantics: destinationSemantics,
      }],
      ['H5P.ColumnPapiJo 1.20', {
        name: columnLibrary.machineName,
        semantics: JSON.parse(fs.readFileSync(path.join(column120Path, 'semantics.json'), 'utf8')),
      }],
      ['H5P.QuestionSetPapiJo 1.23', {
        name: questionSetLibrary.machineName,
        semantics: JSON.parse(fs.readFileSync(path.join(questionSet123Path, 'semantics.json'), 'utf8')),
      }],
      ['H5P.ScaleQuestion 0.2', {
        name: scaleQuestionLibrary.machineName,
        semantics: JSON.parse(fs.readFileSync(path.join(scaleQuestion02Path, 'semantics.json'), 'utf8')),
        upgradesScript: 'upgrades.js',
      }],
    ]);
    const loadRequests = [];
    const loadLibrary = (name, version, done) => {
      const key = `${name} ${version.major}.${version.minor}`;
      loadRequests.push(key);
      const library = libraries.get(key);
      setTimeout(() => done(library ? null : { type: 'libraryMissing', library: name }, library), 0);
    };

    const result = await new Promise((resolve, reject) => {
      new context.H5P.ContentUpgradeProcess(
        'H5P.InteractiveBookPapiJo',
        new context.H5P.Version('1.15'),
        new context.H5P.Version('1.16'),
        JSON.stringify({ params: fixture.params, metadata: fixture.metadata }),
        'interactive-book-1.16-recursive-upgrade',
        loadLibrary,
        (error, upgraded) => error ? reject(error) : resolve(JSON.parse(upgraded))
      );
    });

    const expectedParams = structuredClone(fixture.params);
    expectedParams.chapters.forEach((chapter) => {
      chapter.library = 'H5P.ColumnPapiJo 1.20';
    });
    expectedParams.chapters[0].params.content[1].content.library = 'H5P.ScaleQuestion 0.2';
    const expectedQuestionSet = expectedParams.chapters[1].params.content[0].content;
    expectedQuestionSet.library = 'H5P.QuestionSetPapiJo 1.23';
    expectedQuestionSet.params.questions[0].library = 'H5P.ScaleQuestion 0.2';

    assert.deepEqual(loadRequests, [
      'H5P.InteractiveBookPapiJo 1.16',
      'H5P.ColumnPapiJo 1.20',
      'H5P.ScaleQuestion 0.2',
      'H5P.ColumnPapiJo 1.20',
      'H5P.QuestionSetPapiJo 1.23',
      'H5P.ScaleQuestion 0.2',
      'H5P.ColumnPapiJo 1.20',
    ]);
    assert.equal(scaleUpgradeCalls, 2);
    assert.deepEqual(result.params, expectedParams);
    assert.deepEqual(result.metadata, fixture.metadata);
    assert.deepEqual(fixture, before);

    assert.deepEqual(
      result.params.chapters.map(({ metadata }) => metadata.title),
      before.params.chapters.map(({ metadata }) => metadata.title)
    );
    assert.deepEqual(
      result.params.chapters.map(({ metadata, subContentId }) => ({ metadata, subContentId })),
      before.params.chapters.map(({ metadata, subContentId }) => ({ metadata, subContentId }))
    );
    assert.deepEqual(
      result.params.chapters[0].params.content[0],
      before.params.chapters[0].params.content[0]
    );
    assert.deepEqual(
      result.params.chapters[0].params.content[2],
      before.params.chapters[0].params.content[2]
    );
    assert.deepEqual(
      result.params.chapters[1].params.content[0].content.params.questions[1],
      before.params.chapters[1].params.content[0].content.params.questions[1]
    );
    assert.deepEqual(
      result.params.chapters[1].params.content[1],
      before.params.chapters[1].params.content[1]
    );
    assert.deepEqual(
      result.params.chapters[2].params,
      before.params.chapters[2].params
    );
    assert.equal(fs.existsSync(path.join(root, 'upgrades.js')), false);
  }
);
