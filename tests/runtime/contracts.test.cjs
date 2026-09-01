'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { repoRoot } = require('./helpers/harness.cjs');

const read = (name) => fs.readFileSync(path.join(repoRoot, name), 'utf8');

test('manifest freezes the PapiJo identity and dependency layers', () => {
  const library = JSON.parse(read('library.json'));
  assert.equal(library.machineName, 'H5P.InteractiveBookPapiJo');
  assert.deepEqual(
    [library.majorVersion, library.minorVersion, library.patchVersion],
    [1, 14, 3],
  );
  assert.deepEqual(library.embedTypes, ['iframe']);
  assert.deepEqual(library.coreApi, { majorVersion: 1, minorVersion: 28 });
  assert.deepEqual(library.preloadedJs, [{ path: 'dist/h5p-interactive-book-papijo.js' }]);
  assert.deepEqual(library.preloadedCss, [{ path: 'dist/h5p-interactive-book-papijo.css' }]);

  const dependencies = new Map(library.preloadedDependencies.map((dependency) => [
    dependency.machineName,
    `${dependency.majorVersion}.${dependency.minorVersion}`,
  ]));
  assert.equal(dependencies.get('H5P.ColumnPapiJo'), '1.17');
  assert.equal(dependencies.get('H5P.Components'), '1.0');
});

test('semantics requires one to fifty ColumnPapiJo 1.17 chapters', () => {
  const semantics = JSON.parse(read('semantics.json'));
  const chapters = semantics.find((field) => field.name === 'chapters');
  assert.ok(chapters);
  assert.equal(chapters.min, 1);
  assert.equal(chapters.max, 50);
  const chapterLibrary = chapters.field.fields.find((field) => field.name === 'chapter');
  assert.deepEqual(chapterLibrary.options, ['H5P.ColumnPapiJo 1.17']);
});

test('runtime source freezes the ColumnPapiJo and Components roles', () => {
  const pageContent = read('src/scripts/pagecontent.js');
  const cover = read('src/scripts/cover.js');
  const statusBar = read('src/scripts/statusbar.js');
  const summary = read('src/scripts/summary.js');

  assert.match(pageContent, /H5P\.newRunnable\(config\.chapters\[i\]/);
  assert.match(pageContent, /H5P\.ColumnPapiJo\.isTask\(section\.instance\)/);
  assert.match(pageContent, /machineName === 'H5P\.Row'/);
  assert.match(pageContent, /machineName === 'H5P\.RowColumn'/);
  assert.match(cover, /H5P\.Components\.CoverPage/);
  assert.match(statusBar, /H5P\.Components\.Button/);
  assert.match(summary, /H5P\.Components\.Button/);
});

test('current source lacks displaySubmit and the official core resize guard', () => {
  const app = read('src/scripts/app.js');
  const semantics = read('semantics.json');
  const sourceTree = [
    app,
    semantics,
    read('src/scripts/summary.js'),
  ].join('\n');

  assert.doesNotMatch(sourceTree, /displaySubmit/);
  assert.doesNotMatch(app, /isBubblingUpToCore/);
  assert.match(app, /if \(!this\.bubblingUpwards\)/);
});

test('current summary and fullscreen contracts are Components-based and unconditional on displaySubmit', () => {
  const summary = read('src/scripts/summary.js');
  const statusBar = read('src/scripts/statusbar.js');
  assert.match(summary, /this\.parent\.isSubmitButtonEnabled && this\.parent\.isAnswerUpdated/);
  assert.match(summary, /if \(this\.behaviour\.enableRetry\)/);
  assert.match(summary, /this\.parent\.triggerXAPIScored/);
  assert.match(statusBar, /H5P\.fullScreen\(this\.parent\.mainWrapper, this\.parent\)/);
  assert.match(statusBar, /H5P\.exitFullScreen\(\)/);
  assert.match(statusBar, /this\.parent\.on\('enterFullScreen'/);
  assert.match(statusBar, /this\.parent\.on\('exitFullScreen'/);
});

test('entry point and production distribution retain the PapiJo namespace', () => {
  assert.match(read('src/entries/main.js'), /H5P\.InteractiveBookPapiJo = InteractiveBook/);
  const production = read('dist/h5p-interactive-book-papijo.js');
  assert.match(production, /InteractiveBookPapiJo/);
  assert.match(production, /ColumnPapiJo/);
  assert.doesNotMatch(production, /isBubblingUpToCore/);
});

test('package lock format is version 2', () => {
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.lockfileVersion, 2);
});
