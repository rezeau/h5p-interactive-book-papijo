'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { root, readJson, loadCandidates } = require('../../../tools/verify-release-chain.cjs');

const pluginRoot = process.env.H5P_PLUGIN_ROOT || 'C:/wamp64/www/wp-h5p/wp-content/plugins/h5p';
const corePath = process.env.H5P_CORE_PHP_PATH || path.join(pluginRoot, 'h5p-php-library/h5p.classes.php');
const jsPath = process.env.H5P_CORE_JS_PATH || path.join(pluginRoot, 'h5p-php-library/js');
const baselineJson = (file, minor = 16) => JSON.parse(execFileSync('git',
  ['show', `${minor === 14 ? 'v1.14.3' : `v1.${minor}.0`}:${file}`], { cwd: root, encoding: 'utf8' }));
// Load once per test process. Source failures are fatal, never integration skips.
const actual = loadCandidates();

function probe(input) {
  return JSON.parse(execFileSync(process.env.H5P_PHP_BINARY || 'php',
    ['-d', 'log_errors=0', '-d', 'xdebug.mode=off', path.join(__dirname, 'column-1.21-validator.php')], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      input: JSON.stringify({ corePath,
        candidateLibraries: Object.values(actual).map(({ manifest, semantics }) => ({ manifest, semantics })),
        libraryRoots: [process.env.H5P_LIBRARY_ROOT,
          'C:/wamp64/www/wp-h5p/wp-content/uploads/h5p/libraries',
          'C:/my_first_h5p_environment/libraries'].filter(Boolean), ...input }),
    }));
}
const libraryRow = (manifest, id) => ({ id, name: manifest.machineName,
  major_version: manifest.majorVersion, minor_version: manifest.minorVersion, patch_version: manifest.patchVersion });
function eligibility(target = actual.book.manifest, minor = 16) {
  const source = libraryRow(baselineJson('library.json', minor), 116);
  return probe({ operation: 'eligibility', source,
    versions: [source, libraryRow({ ...baselineJson('library.json', minor), patchVersion: 99 }, 1199),
      libraryRow(target, 117)] });
}

// Installed UI click -> offered version -> batch -> recursive engine.
// Only DOM/transport are adapters. Capture the batch without AJAX/save.
async function offeredUpgrade(content, minor = 16) {
  const offered = eligibility(actual.book.manifest, minor);
  assert.deepEqual(offered, { 117: '1.17.0' });
  const loads = [], invocations = [], batches = [];
  let ready, click, resolveDone, rejectDone;
  const completed = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  const document = {};
  const context = vm.createContext({ H5P: {}, H5PUpgrades: {}, document, window: {}, console, setTimeout });
  const realm = (value) => vm.runInContext(`(${JSON.stringify(value)})`, context);
  const chain = { html() { return this; }, append() { return this; }, appendTo() { return this; },
    text() { return this; }, val() { return '117'; }, ready(fn) { ready = fn; } };
  const $ = (selector, options) => { if (options?.click) click = options.click; return chain; };
  $.post = (url, data, done) => {
    assert.equal(url, 'memory://batch', 'Transport must remain in memory');
    batches.push(structuredClone(data));
    if (data.params !== undefined) {
      resolveDone(JSON.parse(JSON.parse(data.params).fixture));
      return;
    }
    done(realm({ left: 1, token: 'memory', params: {
      fixture: JSON.stringify({ params: content.params, metadata: content.metadata }),
    }, skipped: [] }));
  };
  $.ajax = ({ url, dataType }) => ({ fail() { return this; }, done(fn) {
    try {
      assert.ok(url.startsWith('memory://'), 'Transport must remain in memory');
      if (dataType === 'script') {
        assert.equal(path.basename(url), 'h5p-content-upgrade-process.js');
        vm.runInContext(fs.readFileSync(path.join(jsPath, path.basename(url)), 'utf8'), context, { filename: url });
        const Engine = context.H5P.ContentUpgradeProcess;
        context.H5P.ContentUpgradeProcess = function (...args) {
          invocations.push([args[0], args[1].toString(), args[2].toString()]);
          return new Engine(...args);
        };
        fn();
      }
      else {
        const match = url.match(/\/([^/]+)\/(\d+)\/(\d+)$/);
        assert.ok(match, url);
        const key = `${match[1]} ${match[2]}.${match[3]}`;
        loads.push(key);
        const library = Object.values(actual).find(({ manifest }) =>
          `${manifest.machineName} ${manifest.majorVersion}.${manifest.minorVersion}` === key);
        assert.ok(library, `Unexpected candidate request: ${key}`);
        fn(realm({ name: match[1], semantics: library.semantics }));
      }
    }
    catch (error) { rejectDone(error); }
    return this;
  } });
  context.H5P.jQuery = $;
  context.H5PUtils = { throbber: () => chain };
  context.H5PAdminIntegration = { libraryInfo: {
    library: { name: actual.book.manifest.machineName, version: `1.${minor}` }, versions: offered,
    scriptBaseUrl: 'memory://scripts', libraryBaseUrl: 'memory://libraries', infoUrl: 'memory://batch',
    buster: '', inProgress: 'Upgrading %ver', total: 1, token: 'memory',
    error: 'Upgrade error', errorLibrary: 'Missing %lib', errorScript: 'Missing script %lib',
    errorContent: 'Invalid %id', errorNotSupported: 'Unsupported %used',
    errorTooHighVersion: 'Unsupported %used / %supported',
  } };
  for (const file of ['h5p-version.js', 'h5p-content-upgrade.js']) {
    vm.runInContext(fs.readFileSync(path.join(jsPath, file), 'utf8'), context, { filename: file });
  }
  ready();
  click();
  const output = await completed;
  assert.deepEqual(invocations, [['H5P.InteractiveBookPapiJo', `1.${minor}`, '1.17.0']]);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].libraryId, '117');
  assert.equal(batches[1].libraryId, '117');
  assert.deepEqual(JSON.parse(batches[1].skipped), []);
  return { content: { ...structuredClone(content), library: 'H5P.InteractiveBookPapiJo 1.17', ...output },
    loads, invocations, offered };
}

let id = 0;
const uuid = () => `f62cce2e-5a86-4edb-8a42-${(++id).toString(16).padStart(12, '0')}`;
function textChild(minor = 2, managed = false) {
  const params = {
    text: '<p><strong>Rich text</strong> &amp; accents é <em>preserved</em> ' +
      '<a href="https://example.org/text">Link</a> ' +
      '<span class="papijo-tooltip" data-papijo-tooltip="Tooltip text" ' +
      'data-papijo-tooltip-id="tip-1">Hover</span></p>',
    tooltipImages: [{ id: 'tip-1', alt: 'Tooltip image', image: {
      path: 'images/tooltip.png', mime: 'image/png', width: 80, height: 40,
    } }],
  };
  if (managed) {
    params.text += '<p><span class="papijo-inline-image" data-papijo-inline-image-id="inline-1" ' +
      'data-papijo-inline-image-width="75" data-papijo-inline-image-style="alignLeft" ' +
      'data-papijo-inline-image-link="https://example.org/image">' +
      '<span class="papijo-image-caption">Photo caption</span></span></p>';
    params.inlineImages = [{ id: 'inline-1', alt: 'Managed image', image: {
      path: 'images/managed.png', mime: 'image/png', width: 120, height: 60,
    } }];
  }
  return { library: `H5P.AdvancedTextPapiJo 1.${minor}`, params, subContentId: uuid(),
    metadata: { title: 'Preserved text', license: 'U', defaultLanguage: 'fr',
      authors: [{ name: 'Author', role: 'Author' }] } };
}
function accordion(children = [textChild()], minor = 1) {
  return { library: `H5P.AccordionPapiJo 1.${minor}`, subContentId: uuid(),
    params: { accordionTitle: 'Navigation', hTag: 'h3',
      panels: children.map((content, index) => ({ title: `Panel ${index + 1}`, content })) },
    metadata: { title: 'Accordion title', license: 'U' } };
}
const unaffected = () => ({ library: 'H5P.AdvancedText 1.1', params: { text: '<p>Unaffected sibling</p>' },
  subContentId: uuid(), metadata: { title: 'Sibling', license: 'U' } });
const column = (children, minor = 20) => ({ library: `H5P.ColumnPapiJo 1.${minor}`, subContentId: uuid(),
  metadata: { title: `Page ${id}`, license: 'U' },
  params: { content: children.map((content, index) => ({ content, useSeparator: ['auto', 'enabled', 'disabled'][index % 3] })) } });
const book = (chapters, minor = 16) => ({ library: `H5P.InteractiveBookPapiJo 1.${minor}`,
  params: { showCoverPage: false, chapters, behaviour: { baseColor: '#1768c4',
    defaultTableOfContents: false, progressIndicators: true, progressAuto: false,
    displaySummary: true, enableRetry: false }, read: 'Lire', page: 'Page' },
  metadata: { title: 'Book audit fixture', license: 'U', defaultLanguage: 'fr',
    authors: [{ name: 'Book author', role: 'Author' }] } });
function expectedUpgrade(content) {
  const expected = structuredClone(content);
  const replacements = { 'H5P.InteractiveBookPapiJo': '1.17', 'H5P.ColumnPapiJo': '1.21',
    'H5P.AccordionPapiJo': '1.2', 'H5P.AdvancedTextPapiJo': '1.3' };
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.library) {
      const name = value.library.split(' ')[0];
      if (replacements[name]) value.library = `${name} ${replacements[name]}`;
    }
    Object.values(value).forEach(visit);
  }
  visit(expected);
  return expected;
}
const validate = (content, overrides = {}) => probe({ operation: 'validate', content, ...overrides });
module.exports = { root, pluginRoot, corePath, jsPath, readJson, baselineJson, actual, probe,
  eligibility, offeredUpgrade, textChild, accordion, unaffected, column, book, expectedUpgrade, validate };
