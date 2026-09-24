'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
  EventDispatcher,
  FakeDocument,
  FakeElement,
  FakeJQuery,
  loadProductionClass,
} = require('./helpers/harness.cjs');
const { findLibrary, materializeGitLibrary } = require('./helpers/library-discovery.cjs');

const root = path.resolve(__dirname, '..', '..');
const questionSetCandidates = [
  process.env.H5P_QUESTIONSET_PAPIJO_1221_PATH,
  process.env.H5P_QUESTIONSET_PAPIJO_122_PATH,
  'C:\\wamp64\\www\\wp-h5p\\wp-content\\uploads\\h5p\\libraries\\H5P.QuestionSetPapiJo-1.22',
  'C:\\my_first_h5p_environment\\libraries\\H5P.QuestionSetPapiJo-1.22',
  path.resolve(root, '..', 'papi-jo-h5p-questionset'),
].filter(Boolean);
let questionSetPath = findLibrary(questionSetCandidates, {
  machineName: 'H5P.QuestionSetPapiJo',
  majorVersion: 1,
  minorVersion: 22,
  patchVersion: 1,
}, ['js/questionset.js', 'tests/reset-task-instance-scope.test.cjs']);
const questionSetSnapshot = questionSetPath ? undefined : materializeGitLibrary([
  process.env.H5P_QUESTIONSET_PAPIJO_REPOSITORY,
  path.resolve(root, '..', 'papi-jo-h5p-questionset'),
].filter(Boolean), 'v1.22.1', {
  machineName: 'H5P.QuestionSetPapiJo',
  majorVersion: 1,
  minorVersion: 22,
  patchVersion: 1,
}, ['js/questionset.js', 'tests/reset-task-instance-scope.test.cjs']);
if (questionSetSnapshot) {
  questionSetPath = questionSetSnapshot.path;
  test.after(() => questionSetSnapshot.cleanup());
}

test('summary defers its baseline and action-button state reads until chapters are initialized', () => {
  const document = new FakeDocument();
  document.querySelectorAll = () => [];
  const H5P = {
    Components: { Button: () => new FakeElement('button') },
    EventDispatcher,
  };
  const Summary = loadProductionClass('src/scripts/summary.js', 'Summary', {
    H5P,
    document,
    setTimeout,
  }).Class;
  const parent = new EventDispatcher();
  parent.isAnswerUpdated = true;
  parent.isSubmitButtonEnabled = false;
  let stateReadCount = 0;
  const detachedChild = {
    getCurrentState() {
      stateReadCount++;
      return { instances: [{}] };
    },
  };
  const chapter = {
    instance: detachedChild,
    isInitialized: false,
    isSummary: false,
    sections: [{ taskDone: false }],
  };

  const summary = new Summary({ behaviour: {}, l10n: {} }, parent, [chapter]);
  assert.equal(stateReadCount, 0);
  assert.equal(summary.tempState, null);

  summary.wrapper = new FakeElement('div');
  assert.doesNotThrow(() => summary.addActionButtons());
  assert.equal(stateReadCount, 0);
  assert.equal(summary.tempState, null);

  chapter.isInitialized = true;
  summary.checkTheAnswerIsUpdated();
  assert.equal(stateReadCount, 1);
  assert.deepEqual(JSON.parse(summary.tempState), [{
    sections: [{ taskDone: false }],
    state: { instances: [{}] },
  }]);
});

test('summary defers live scores for chapters that have not attached their children', () => {
  const document = new FakeDocument();
  document.querySelectorAll = () => [];
  const H5P = {
    Components: { Button: () => new FakeElement('button') },
    EventDispatcher,
    JoubelUI: {
      createScoreBar: () => ({
        appendTo() {},
        setScore() {},
      }),
    },
  };
  const Summary = loadProductionClass('src/scripts/summary.js', 'Summary', {
    H5P,
    document,
    setTimeout,
  }).Class;
  const parent = new EventDispatcher();
  parent.chapters = [];
  parent.getChapterStatus = () => 'blank';
  parent.getMaxScore = () => chapters.reduce((score, chapter) => score + chapter.instance.getMaxScore(), 0);
  parent.getScore = () => chapters.reduce((score, chapter) => score + chapter.instance.getScore(), 0);
  parent.isAnswerUpdated = false;
  parent.isSubmitButtonEnabled = false;
  let childAttached = false;
  let scoreReadCount = 0;
  const makeChapter = (title, isInitialized, instance) => ({
    instance: {
      getMaxScore: () => instance.getMaxScore(),
      getScore: () => instance.getScore(),
      subContentId: title.toLowerCase().replaceAll(' ', '-'),
    },
    isInitialized,
    maxTasks: 1,
    sections: [{
      content: { metadata: { title: `${title} interaction` } },
      instance,
      isTask: true,
      taskDone: false,
    }],
    tasksLeft: 1,
    title,
  });
  const detachedAdvancedBlanks = {
    contentData: { metadata: { title: 'Detached Advanced Blanks' } },
    getMaxScore() {
      scoreReadCount++;
      if (!childAttached) {
        throw new TypeError('this.cloze is undefined');
      }
      return 2;
    },
    getScore() {
      scoreReadCount++;
      if (!childAttached) {
        throw new TypeError('this.cloze is undefined');
      }
      return 1;
    },
    subContentId: 'detached-advanced-blanks',
  };
  const initializedInteraction = {
    contentData: { metadata: { title: 'Initialized interaction' } },
    getMaxScore: () => 1,
    getScore: () => 1,
    subContentId: 'initialized-interaction',
  };
  const chapters = [
    makeChapter('Earlier chapter', false, detachedAdvancedBlanks),
    makeChapter('Reloaded later chapter', true, initializedInteraction),
  ];

  const summary = new Summary({
    behaviour: { enableRetry: false, progressIndicators: false },
    l10n: {
      allInteractions: 'All interactions',
      leftOutOfTotalCompleted: '@left of @max completed',
      noInteractions: 'No interactions',
      score: 'Score',
      scoreText: '@score / @maxscore',
      summaryAndSubmit: 'Summary',
      unansweredInteractions: 'Unanswered interactions',
      yourAnswersAreSubmittedForReview: 'Submitted',
    },
  }, parent, chapters);

  assert.doesNotThrow(() => summary.addSummaryPage(new FakeJQuery()));
  assert.equal(scoreReadCount, 0);

  childAttached = true;
  chapters[0].isInitialized = true;
  assert.doesNotThrow(() => summary.createChapterOverview(chapters[0]));
  assert.equal(scoreReadCount, 2);
});

test(
  'released QuestionSetPapiJo 1.22.1 resets unequal instances without progress-dot leakage',
  {
    skip: !questionSetPath
      ? 'QuestionSetPapiJo 1.22.1 source and reset harness are unavailable locally or at tag v1.22.1'
      : false,
  },
  () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(questionSetPath, 'library.json'), 'utf8'));
    assert.deepEqual(
      [manifest.machineName, manifest.majorVersion, manifest.minorVersion, manifest.patchVersion],
      ['H5P.QuestionSetPapiJo', 1, 22, 1],
    );
    const questionSetSource = fs.readFileSync(path.join(questionSetPath, 'js', 'questionset.js'), 'utf8');
    assert.doesNotMatch(questionSetSource, /\$\('\.h5p-progress-dot'\)\.each\(function \(idx\)/);
    assert.match(questionSetSource, /\$\('\.h5p-progress-dot', this\.nav\.progressDots\)\.each\(function \(idx\)/);
    assert.match(questionSetSource, /this\.nav\.progressDots\.toggleFilledDot\(dotIndex, isAnswered\)/);

    const harnessFile = path.join(questionSetPath, 'tests', 'reset-task-instance-scope.test.cjs');
    const harnessSource = fs.readFileSync(harnessFile, 'utf8');
    const testStart = harnessSource.indexOf("test('resetTask clears only");
    assert.notEqual(testStart, -1);
    const module = { exports: {} };
    const harnessContext = vm.createContext({
      __dirname: path.dirname(harnessFile),
      clearTimeout,
      console,
      exports: module.exports,
      module,
      require,
      setTimeout,
    });
    vm.runInContext(
      `${harnessSource.slice(0, testStart)}\nmodule.exports = { createHarness };`,
      harnessContext,
      { filename: harnessFile },
    );
    const { H5P, FakeElement: QuestionSetElement } = module.exports.createHarness();
    const makeOptions = (count) => ({
      questions: Array.from({ length: count }, () => ({
        library: 'H5P.MockQuestion 1.0',
        params: {},
      })),
      introPage: { showIntroPage: true },
    });
    const first = new H5P.QuestionSetPapiJo(makeOptions(2), 1, {});
    const second = new H5P.QuestionSetPapiJo(makeOptions(3), 2, {});
    const firstHost = new QuestionSetElement('host');
    const secondHost = new QuestionSetElement('host');
    new QuestionSetElement('parent').appendChild(firstHost);
    new QuestionSetElement('parent').appendChild(secondHost);
    first.attach(firstHost);
    second.attach(secondHost);
    first.nav.progressDots.calls.length = 0;
    second.nav.progressDots.calls.length = 0;

    assert.doesNotThrow(() => {
      [first, second].forEach((questionSet) => questionSet.resetTask());
    });
    const normalizeCalls = (calls) => Array.from(calls, (call) => Array.from(call));
    assert.deepEqual(normalizeCalls(first.nav.progressDots.calls), [[0, false], [1, false]]);
    assert.deepEqual(normalizeCalls(second.nav.progressDots.calls), [[0, false], [1, false], [2, false]]);
  },
);
