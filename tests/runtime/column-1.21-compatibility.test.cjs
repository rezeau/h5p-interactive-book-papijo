'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { assertChain, candidate, assertPackageColumn } = require('../../tools/verify-release-chain.cjs');
const { root, pluginRoot, corePath, baselineJson, actual, eligibility, offeredUpgrade,
  textChild, accordion, unaffected, column, book, expectedUpgrade, validate } =
  require('./helpers/interactivebook-candidate.cjs');

const baseLoads = ['H5P.InteractiveBookPapiJo 1.17', 'H5P.ColumnPapiJo 1.21'];
function assertDependencies(result, { text = true, nested = false, sibling = false } = {}) {
  assert.deepEqual(result.errors, []);
  assert.equal(path.resolve(result.validatorPath), path.resolve(corePath));
  assert.equal(path.resolve(result.dependencyTraversalPath), path.resolve(corePath));
  const required = [
    ['H5P.InteractiveBookPapiJo', 1, 17, 'preloaded'], ['H5P.ColumnPapiJo', 1, 21, 'preloaded'],
    ['FontAwesome', 4, 5, 'preloaded'], ['H5P.JoubelUI', 1, 3, 'preloaded'],
    ['H5P.Components', 1, 0, 'preloaded'], ['H5P.Transition', 1, 0, 'preloaded'],
    ['H5P.FontIcons', 1, 0, 'preloaded'], ['jQuery.ui', 1, 10, 'preloaded'],
    ['H5PEditor.VerticalTabs', 1, 3, 'editor'], ['H5PEditor.ShowWhen', 1, 0, 'editor'],
    ['H5PEditor.ColorSelector', 1, 3, 'editor'],
  ];
  if (text) required.push(['H5P.AdvancedTextPapiJo', 1, 3, 'preloaded'],
    ['H5PEditor.AdvancedTextPapiJoTooltip', 1, 2, 'editor']);
  if (nested) required.push(['H5P.AccordionPapiJo', 1, 2, 'preloaded']);
  if (sibling) required.push(['H5P.AdvancedText', 1, 1, 'preloaded']);
  for (const [machineName, majorVersion, minorVersion, type] of required) {
    const dependency = result.dependencies.find((d) => d.machineName === machineName && d.type === type);
    assert.ok(dependency, `${type} ${machineName}`);
    assert.deepEqual([dependency.majorVersion, dependency.minorVersion], [majorVersion, minorVersion]);
    assert.ok(dependency.weight > 0);
  }
  const chainNames = Object.values(actual).map(({ manifest }) => manifest.machineName);
  assert.equal(result.dependencies.filter((d) => chainNames.includes(d.machineName)).length,
    2 + (text ? 2 : 0) + (nested ? 1 : 0));
  for (const d of result.dependencies.filter((d) => chainNames.includes(d.machineName))) {
    const manifest = Object.values(actual).find((c) => c.manifest.machineName === d.machineName).manifest;
    assert.deepEqual([d.majorVersion, d.minorVersion], [manifest.majorVersion, manifest.minorVersion]);
  }
}
async function check(before, loads, dependencies = {}, minor = 16) {
  const snapshot = structuredClone(before);
  const result = await offeredUpgrade(before, minor);
  assert.deepEqual(result.content, expectedUpgrade(before), 'Only library references may change');
  assert.deepEqual(result.loads, loads, 'UI library loader must consume the actual complete chain');
  const filtered = validate(result.content);
  assert.deepEqual(filtered.content, result.content,
    'Installed normal validation must preserve all authored valid fields, order and optional absence');
  assertDependencies(filtered, dependencies);
  assert.deepEqual(before, snapshot, 'Source fixture must remain untouched');
  return { result, filtered };
}

test('WordPress main-library selection offers 1.17.0, excludes patches, and submits the selected library ID', async () => {
  const admin = fs.readFileSync(path.join(pluginRoot, 'admin/class-h5p-library-admin.php'), 'utf8');
  assert.match(admin, /ON hl2\.name = hl1\.name/);
  assert.match(admin, /\$upgrades = \$core->getUpgrades\(\$version, \$versions\)/);
  assert.match(admin, /'versions' => \$upgrades/);
  assert.match(admin, /filter_input\(INPUT_POST, 'libraryId'\)/);
  assert.match(admin, /'library_id' => \$to_library->id/);
  assert.deepEqual(eligibility(), { 117: '1.17.0' });
  assert.deepEqual(eligibility({ ...baselineJson('library.json'), patchVersion: 99 }), {});
  const before = book([column([textChild()])]);
  await check(before, [...baseLoads, 'H5P.AdvancedTextPapiJo 1.3']);
});

for (const [bookMinor, columnMinor] of [[14, 17], [15, 19], [16, 20]]) {
  for (const managed of [false, true]) {
    test(`CASE A: selected Book 1.${bookMinor} / Column 1.${columnMinor} -> 1.17 / 1.21 / actual Text 1.3; inline store ${managed ? 'present' : 'absent'}`, async () => {
      await check(book([column([textChild(2, managed), unaffected()], columnMinor)], bookMinor),
        [...baseLoads, 'H5P.AdvancedTextPapiJo 1.3'], { sibling: true }, bookMinor);
    });
  }
  test(`unaffected children survive selected Book 1.${bookMinor} / Column 1.${columnMinor} upgrade`, async () => {
    await check(book([column([unaffected()], columnMinor)], bookMinor), baseLoads,
      { text: false, sibling: true }, bookMinor);
  });
}

for (const managed of [false, true]) {
  test(`CASE B: Book -> Column -> public Accordion 1.2 -> actual Text 1.3; inline store ${managed ? 'present' : 'absent'}`, async () => {
    await check(book([column([accordion([textChild(2, managed), textChild(2, !managed)])])]),
      [...baseLoads, 'H5P.AccordionPapiJo 1.2', 'H5P.AdvancedTextPapiJo 1.3'], { nested: true });
  });
}

test('CASE C: mixed three-chapter book upgrades both chains once and preserves settings/order/siblings/current children', async () => {
  const before = book([
    column([textChild(2, true), unaffected(), accordion([textChild(), textChild(3, true)])]),
    column([accordion([textChild(2, true), textChild()]), textChild(3, true), unaffected()]),
    column([unaffected()]),
  ]);
  const { filtered } = await check(before, [...baseLoads, 'H5P.AdvancedTextPapiJo 1.3',
    'H5P.AccordionPapiJo 1.2'], { nested: true, sibling: true });
  assert.equal(filtered.content.params.chapters.length, 3);
  assert.equal(filtered.content.params.chapters[1].params.content[0].content.params.panels.length, 2);
  console.log(`Mixed book rebuilt ${filtered.dependencies.length} runtime/editor dependency entries.`);
});

test('CASE D: old Columns with already-current Accordion/Text survive without loading or transforming children', async () => {
  await check(book([column([textChild(3, true), accordion([textChild(3)], 2), unaffected()])]),
    baseLoads, { nested: true, sibling: true });
});
test('CASE D: already-current Column with structurally current descendants is preserved without child loading', async () => {
  await check(book([column([textChild(3, true), accordion([textChild(3)], 2)], 21)]),
    ['H5P.InteractiveBookPapiJo 1.17'], { nested: true });
});
test('absent optional text/image/book fields remain absent through upgrade and normal validation', async () => {
  const child = textChild();
  delete child.params.tooltipImages;
  delete child.metadata;
  const before = book([column([child])]);
  delete before.params.behaviour.enableRetry;
  const { filtered } = await check(before, [...baseLoads, 'H5P.AdvancedTextPapiJo 1.3']);
  const after = filtered.content.params.chapters[0].params.content[0].content;
  for (const key of ['tooltipImages', 'inlineImages']) assert.equal(Object.hasOwn(after.params, key), false);
  assert.equal(Object.hasOwn(after, 'metadata'), false);
  assert.equal(Object.hasOwn(filtered.content.params, 'bookCover'), false);
  assert.equal(Object.hasOwn(filtered.content.params.behaviour, 'enableRetry'), false);
});

test('normal filtering removes unsafe HTML/unknown fields while preserving both migrated chains and managed data', async () => {
  const direct = textChild(2, true), nested = textChild();
  const before = book([column([direct, accordion([nested])])]);
  before.params.unknown = 'remove';
  before.params.chapters[0].unknown = 'remove';
  before.params.chapters[0].params.unknown = 'remove';
  before.params.chapters[0].params.content[0].unknown = 'remove';
  before.params.chapters[0].params.content[1].content.params.unknown = 'remove';
  for (const child of [direct, nested]) {
    child.params.text += '<script>alert(1)</script><p onclick="evil()">Safe</p><a href="javascript:evil()">Link</a>';
    for (const object of [child, child.params, child.metadata, child.params.tooltipImages[0],
      child.params.tooltipImages[0].image]) object.unknown = 'remove';
  }
  const upgraded = await offeredUpgrade(before);
  assert.deepEqual(upgraded.content, expectedUpgrade(before), 'Upgrade preserves input before filtering');
  const filtered = validate(upgraded.content);
  assertDependencies(filtered, { nested: true });
  const entries = filtered.content.params.chapters[0].params.content;
  for (const [child, original] of [[entries[0].content, direct], [entries[1].content.params.panels[0].content, nested]]) {
    assert.ok(child);
    assert.equal(child.library, 'H5P.AdvancedTextPapiJo 1.3');
    assert.equal(child.subContentId, original.subContentId);
    assert.equal(child.metadata.title, original.metadata.title);
    assert.match(child.params.text, /<strong>Rich text<\/strong>/);
    assert.match(child.params.text, /data-papijo-tooltip="Tooltip text"/);
    assert.doesNotMatch(child.params.text, /<script|onclick|javascript:/i);
    for (const object of [child, child.params, child.metadata, child.params.tooltipImages[0],
      child.params.tooltipImages[0].image]) assert.equal(Object.hasOwn(object, 'unknown'), false);
    assert.equal(child.params.tooltipImages[0].image.path, 'images/tooltip.png');
  }
  assert.deepEqual(entries[0].content.params.inlineImages, direct.params.inlineImages);
  for (const attribute of ['id', 'width', 'style', 'link']) {
    assert.match(entries[0].content.params.text, new RegExp(`data-papijo-inline-image-${attribute}=`));
  }
  assert.match(entries[0].content.params.text, /papijo-image-caption">Photo caption/);
  for (const object of [filtered.content.params, filtered.content.params.chapters[0],
    filtered.content.params.chapters[0].params, entries[0], entries[1].content.params]) {
    assert.equal(Object.hasOwn(object, 'unknown'), false);
  }
});

test('old Book page semantics reject upgraded Column pages before children/dependencies can survive', async () => {
  const result = await offeredUpgrade(book([column([textChild(), accordion()])]));
  const candidates = Object.values(actual).map(({ manifest, semantics }) => ({ manifest, semantics }));
  candidates.find((c) => c.manifest.machineName === 'H5P.InteractiveBookPapiJo').semantics = baselineJson('semantics.json');
  const filtered = validate(result.content, { candidateLibraries: candidates });
  assert.equal(Object.hasOwn(filtered.content.params, 'chapters'), false);
  assert.ok(filtered.errors.some((e) => /ColumnPapiJo 1\.21.*ColumnPapiJo 1\.20/.test(e.message)));
  assert.equal(filtered.dependencies.some((d) => ['H5P.AdvancedTextPapiJo', 'H5P.AccordionPapiJo'].includes(d.machineName)), false);
});

const mutations = [
  ['old Book preload target', (c) => { c.book.manifest.preloadedDependencies.find((d) => d.machineName === 'H5P.ColumnPapiJo').minorVersion = 20; }],
  ['old Book authoring target', (c) => { c.book.semantics.find((f) => f.name === 'chapters').field.fields[0].options = ['H5P.ColumnPapiJo 1.20']; }],
  ['unrepaired Column commit', (c) => { c.column.head = '0000000000000000000000000000000000000000'; }],
  ['dirty Column candidate', (c) => { c.column.status = ' M semantics.json'; }],
  ['Column still targets Accordion 1.1', (c) => { const o = c.column.semantics[0].field.fields[0].options; o[o.indexOf('H5P.AccordionPapiJo 1.2')] = 'H5P.AccordionPapiJo 1.1'; }],
  ['broken public Accordion 1.1.7', (c) => { Object.assign(c.accordion.manifest, { minorVersion: 1, patchVersion: 7 }); }],
  ['private recovery Accordion 1.1.8', (c) => { Object.assign(c.accordion.manifest, { minorVersion: 1, patchVersion: 8 }); }],
  ['Accordion still targets Text 1.2', (c) => { const o = c.accordion.semantics.find((f) => f.name === 'panels').field.fields.find((f) => f.name === 'content').options; o[o.indexOf('H5P.AdvancedTextPapiJo 1.3')] = 'H5P.AdvancedTextPapiJo 1.2'; }],
  ['Column still targets Text 1.2', (c) => { const o = c.column.semantics[0].field.fields[0].options; o[o.indexOf('H5P.AdvancedTextPapiJo 1.3')] = 'H5P.AdvancedTextPapiJo 1.2'; }],
  ['legacy AdvancedText 1.2.6 sources', (c) => { Object.assign(c.advanced.manifest, { minorVersion: 2, patchVersion: 6 }); }],
  ['old tooltip editor manifest', (c) => { c.editor.manifest.minorVersion = 1; }],
  ['old tooltip editor dependency', (c) => { c.advanced.manifest.editorDependencies[0].minorVersion = 1; }],
];
for (const [name, mutate] of mutations) {
  test(`release-chain gate rejects ${name}`, () => {
    const broken = structuredClone(actual);
    mutate(broken);
    assert.throws(() => assertChain(broken));
  });
}
test('explicit missing/legacy candidate sources fail without fallback or version rewriting', () => {
  const missing = path.join(root, 'tests/fixtures/nonexistent-actual-candidate');
  assert.equal(fs.existsSync(missing), false);
  assert.throws(() => candidate(missing, 'H5P.AdvancedTextPapiJo', [1, 3, 0]), /ENOENT/);
  const result = spawnSync(process.execPath, [path.join(root, 'tools/verify-release-chain.cjs')], {
    encoding: 'utf8', env: { ...process.env, H5P_COLUMN_PAPIJO_121_PATH: missing },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
  const legacyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'book-rejected-legacy-source-'));
  try {
    // A deliberately invalid input, never registered with either H5P engine.
    const legacy = { ...actual.advanced.manifest, minorVersion: 2, patchVersion: 6 };
    fs.writeFileSync(path.join(legacyDirectory, 'library.json'), JSON.stringify(legacy));
    assert.throws(() => candidate(legacyDirectory, 'H5P.AdvancedTextPapiJo', [1, 3, 0]),
      /Actual candidate required/);
    const rejected = spawnSync(process.execPath, [path.join(root, 'tools/verify-release-chain.cjs')], {
      encoding: 'utf8', env: { ...process.env, H5P_ADVANCEDTEXT_PAPIJO_13_PATH: legacyDirectory },
    });
    assert.notEqual(rejected.status, 0, 'Explicit legacy source must never fall back to the actual sibling');
    assert.match(rejected.stderr, /Actual candidate required/);
  }
  finally { fs.rmSync(legacyDirectory, { recursive: true, force: true }); }
});
test('package preflight rejects same-version Column sources with unrepaired Accordion semantics before building', () => {
  assertPackageColumn(actual.column.directory, actual);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'book-column-preflight-'));
  try {
    fs.copyFileSync(path.join(actual.column.directory, 'library.json'), path.join(directory, 'library.json'));
    const broken = structuredClone(actual.column.semantics);
    const options = broken[0].field.fields[0].options;
    options[options.indexOf('H5P.AccordionPapiJo 1.2')] = 'H5P.AccordionPapiJo 1.1';
    fs.writeFileSync(path.join(directory, 'semantics.json'), JSON.stringify(broken));
    assert.throws(() => assertPackageColumn(directory, actual), /repaired Column candidate: semantics.json/);
    const builder = fs.readFileSync(path.join(root, 'tools/build-release-package.ps1'), 'utf8');
    assert.ok(builder.indexOf('verify-release-chain.cjs') < builder.indexOf('New-Item -ItemType Directory'));
  }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
