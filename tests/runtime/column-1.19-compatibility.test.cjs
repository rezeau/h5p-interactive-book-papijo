'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
  FakeDocument,
  FakeElement,
  FakeWindow,
  loadProductionClass,
  minimalConfig,
} = require('./helpers/harness.cjs');

const root = path.resolve(__dirname, '..', '..');
const columnCandidates = [
  process.env.H5P_COLUMN_PAPIJO_119_PATH,
  path.resolve(root, '..', 'papi-jo-h5p-column'),
].filter(Boolean);
const columnPath = columnCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'library.json')) &&
  fs.existsSync(path.join(candidate, 'scripts', 'h5p-column.js'))
);

function createXAPIEvent(verb, score, maxScore) {
  return {
    type: 'xAPI',
    data: { statement: { object: { definition: { extensions: {} } } } },
    getVerb() { return verb; },
    getScore() { return score; },
    getMaxScore() { return maxScore; },
    getVerifiedStatementValue(parts) {
      let value = this.data.statement;
      for (const part of parts) {
        value[part] = value[part] || {};
        value = value[part];
      }
      return value;
    },
    setScoredResult(raw, max, source, completion, success) {
      this.data.statement.result = { score: { raw, max }, completion, success };
      this.scoredResult = { raw, max, source, completion, success };
    },
  };
}

function createCompatibilityHarness() {
  const document = new FakeDocument();
  const window = new FakeWindow();
  const runnableCalls = [];
  const questions = new Map();
  let H5P;

  function EventDispatcher() {
    this._listeners = this._listeners || new Map();
    this._triggerLog = this._triggerLog || [];
  }
  EventDispatcher.prototype.on = function (name, handler, context) {
    const listeners = this._listeners.get(name) || [];
    listeners.push({ handler, context });
    this._listeners.set(name, listeners);
    return this;
  };
  EventDispatcher.prototype.listenerCount = function (name) {
    return (this._listeners.get(name) || []).length;
  };
  EventDispatcher.prototype.trigger = function (name, event) {
    if (typeof name === 'object') {
      event = name;
      name = event.type || 'xAPI';
    }
    else if (!(event && event.type && Object.hasOwn(event, 'data'))) {
      event = { type: name, data: event };
    }
    this._triggerLog.push({ name, event, bubblingUpwards: this.bubblingUpwards });
    for (const { handler, context } of [...(this._listeners.get(name) || [])]) {
      handler.call(context || this, event);
    }
    if (name === 'xAPI' && H5P && this !== H5P.externalDispatcher) {
      H5P.externalDispatcher.emitFrom(this, event);
    }
    return this;
  };
  EventDispatcher.prototype.triggerCount = function (name) {
    return this._triggerLog.filter((entry) => entry.name === name).length;
  };
  EventDispatcher.prototype.createXAPIEventTemplate = function (verb) {
    return createXAPIEvent(verb);
  };
  EventDispatcher.prototype.triggerXAPIScored = function (raw, max, verb) {
    const event = createXAPIEvent(verb, raw, max);
    event.setScoredResult(raw, max, this, true, raw === max);
    this.trigger('xAPI', event);
  };
  EventDispatcher.prototype.setActivityStarted = function (force) {
    this._activityStarted = (this._activityStarted || 0) + 1;
    this._activityForce = force;
  };

  class JQueryWrapper {
    constructor(element) {
      this[0] = element;
      this.length = 1;
    }
    addClass(names) {
      String(names).split(/\s+/).filter(Boolean).forEach((name) => this[0].classList.add(name));
      return this;
    }
    removeClass(names) {
      String(names).split(/\s+/).filter(Boolean).forEach((name) => this[0].classList.remove(name));
      return this;
    }
    hasClass(name) { return this[0].classList.contains(name); }
    append(node) {
      this[0].appendChild(node instanceof JQueryWrapper ? node[0] : node);
      return this;
    }
    html(value) {
      if (value === '') {
        this[0].innerHTML = '';
      }
      return this;
    }
    width() { return this[0].offsetWidth; }
    css(name) { return name === 'font-size' ? '16px' : ''; }
    get(index) { return this[index]; }
  }

  const externalDispatcher = new EventDispatcher();
  externalDispatcher.emitFrom = function (source, event) {
    for (const { handler, context } of [...(this._listeners.get('xAPI') || [])]) {
      handler.call(context || source, event);
    }
  };

  function makeQuestion(content, contentData, score, maxScore) {
    const question = new EventDispatcher();
    question.libraryInfo = { machineName: 'H5P.QuestionSetPapiJo' };
    question.subContentId = content.subContentId;
    question.contentData = contentData;
    question.attachCount = 0;
    question.answered = false;
    question.attach = () => question.attachCount++;
    question.getScore = () => score;
    question.getMaxScore = () => maxScore;
    question.getAnswerGiven = () => question.answered;
    question.getCurrentState = () => ({
      restored: contentData.previousState || null,
      answered: question.answered,
    });
    question.getXAPIData = () => ({ statement: { id: question.subContentId } });
    question.resetTask = () => { question.answered = false; };
    question.answer = () => {
      question.answered = true;
      question.trigger('xAPI', createXAPIEvent('answered', score, maxScore));
    };
    questions.set(question.subContentId, question);
    return question;
  }

  function makeRow(content, contentData) {
    const nestedContent = content.params.columns[0].content.params.content[0];
    const nestedState = contentData.previousState?.columns?.[0]?.instances?.[0];
    const nestedQuestion = makeQuestion(
      nestedContent,
      { parent: null, previousState: nestedState },
      2,
      3
    );
    const rowColumn = new EventDispatcher();
    rowColumn.libraryInfo = { machineName: 'H5P.RowColumn' };
    rowColumn.getInstances = () => [nestedQuestion];
    nestedQuestion.contentData.parent = rowColumn;

    const row = new EventDispatcher();
    row.libraryInfo = { machineName: 'H5P.Row' };
    row.subContentId = content.subContentId;
    row.contentData = contentData;
    row.attachCount = 0;
    row.getInstances = () => [rowColumn];
    row.attach = () => {
      row.attachCount++;
      if (nestedQuestion.attachCount === 0) {
        nestedQuestion.attach();
      }
    };
    row.getScore = () => nestedQuestion.getScore();
    row.getMaxScore = () => nestedQuestion.getMaxScore();
    row.getAnswerGiven = () => nestedQuestion.getAnswerGiven();
    row.getCurrentState = () => ({ columns: [{ instances: [nestedQuestion.getCurrentState()] }] });
    row.getXAPIDataFromChildren = () => [nestedQuestion.getXAPIData()];
    row.resetTask = () => nestedQuestion.resetTask();
    return row;
  }

  H5P = {
    EventDispatcher,
    externalDispatcher,
    isFullscreen: false,
    jQuery(value) { return value instanceof JQueryWrapper ? value : new JQueryWrapper(value); },
    createTitle(value) { return String(value); },
    on(target, name, handler) { target.on(name, handler); },
    trigger(target, name, data) { target.trigger(name, data); },
    Transition: { onTransitionEnd(wrapper, handler) { handler(); } },
  };
  H5P.jQuery.extend = (target, source) => Object.assign(target, source);

  const columnLibrary = JSON.parse(fs.readFileSync(path.join(columnPath, 'library.json'), 'utf8'));
  assert.deepEqual(
    [columnLibrary.machineName, columnLibrary.majorVersion, columnLibrary.minorVersion, columnLibrary.patchVersion],
    ['H5P.ColumnPapiJo', 1, 19, 0]
  );
  const columnContext = vm.createContext({ H5P, document, window, console, setTimeout });
  vm.runInContext(
    fs.readFileSync(path.join(columnPath, 'scripts', 'h5p-column.js'), 'utf8'),
    columnContext,
    { filename: 'H5P.ColumnPapiJo-1.19/scripts/h5p-column.js' }
  );

  H5P.newRunnable = (content, contentId, subContentId, skipResize, contentData) => {
    runnableCalls.push({ content, contentId, subContentId, skipResize, contentData });
    const machineName = content.library.split(' ')[0];
    if (machineName === 'H5P.ColumnPapiJo') {
      const column = new H5P.ColumnPapiJo(content.params, contentId, contentData);
      column.libraryInfo = { machineName };
      column.subContentId = content.subContentId;
      return column;
    }
    if (machineName === 'H5P.QuestionSetPapiJo') {
      return makeQuestion(content, contentData, 1, 2);
    }
    if (machineName === 'H5P.Row') {
      return makeRow(content, contentData);
    }
    throw new Error(`Unexpected runnable ${content.library}`);
  };

  class Summary extends EventDispatcher {
    addSummaryPage() {}
    setChapters() {}
  }
  const URLTools = {
    extractFragmentsFromURL(validate, hashWindow) {
      return hashWindow.__fragments ? { ...hashWindow.__fragments } : {};
    },
    createFragmentsString(value) { return JSON.stringify(value); },
    areFragmentsEqual(left, right, keys) { return keys.every((key) => left[key] === right[key]); },
  };
  const pageContent = loadProductionClass('src/scripts/pagecontent.js', 'PageContent', {
    H5P, URLTools, Summary, document, window, self: window, setTimeout,
  }).Class;

  class SideBar {
    constructor() {
      this.container = new FakeElement('nav');
      this.progressUpdates = [];
      this.sectionMarkers = [];
    }
    updateChapterProgressIndicator(chapterId, status) {
      this.progressUpdates.push({ chapterId, status });
    }
    setSectionMarker(chapterId, sectionId) {
      this.sectionMarkers.push({ chapterId, sectionId });
    }
    resetIndicators() {}
    redirectHandler() {}
    focus() {}
  }
  class StatusBar {
    constructor() {
      this.wrapper = new FakeElement('header');
      this.menuToggleButton = new FakeElement('button');
      this.progressBar = { progress: new FakeElement('button') };
    }
    updateStatusBar() {}
    isMenuOpen() { return false; }
  }
  class Cover {
    constructor() { this.container = new FakeElement('div'); }
    initMedia() {}
  }
  const Colors = { isBaseColor() { return true; } };
  const tinycolor = () => ({
    clone() { return this; }, darken() { return this; }, lighten() { return this; },
    getBrightness() { return 0; }, toHexString() { return '#000000'; },
  });
  tinycolor.mix = tinycolor;

  const InteractiveBook = loadProductionClass('src/scripts/app.js', 'InteractiveBook', {
    Colors,
    Cover,
    DOMException,
    H5P,
    H5PIntegration: {},
    PageContent: pageContent,
    SideBar,
    StatusBar,
    URLTools,
    document,
    self: window,
    setTimeout,
    tinycolor,
    top: window,
    window,
  }).Class;

  return { H5P, InteractiveBook, JQueryWrapper, document, questions, runnableCalls, window };
}

function chapter(title, subContentId, content) {
  return {
    library: 'H5P.ColumnPapiJo 1.19',
    metadata: { title },
    subContentId,
    params: { content },
  };
}

test(
  'InteractiveBook composes with real ColumnPapiJo 1.19 and QuestionSetPapiJo 1.22.1-shaped children',
  { skip: !columnPath ? 'H5P.ColumnPapiJo 1.19 source is unavailable' : false },
  async () => {
    const harness = createCompatibilityHarness();
    const directContent = {
      library: 'H5P.QuestionSetPapiJo 1.22',
      subContentId: 'question-set-direct',
      params: {},
    };
    const nestedContent = {
      library: 'H5P.QuestionSetPapiJo 1.22',
      subContentId: 'question-set-nested',
      params: {},
    };
    const rowContent = {
      library: 'H5P.Row 1.3',
      subContentId: 'row',
      params: {
        columns: [{
          content: {
            params: { content: [nestedContent] },
          },
        }],
      },
    };
    const config = minimalConfig(0);
    config.behaviour.displaySummary = false;
    config.chapters = [
      chapter('Direct', 'column-direct', [{ content: directContent }]),
      chapter('Nested', 'column-nested', [{ content: rowContent }]),
    ];
    const previousState = {
      chapters: [
        {
          completed: false,
          tasksLeft: 1,
          sections: [{ taskDone: false }],
          state: { instances: [{ saved: 'direct' }] },
        },
        {
          completed: false,
          tasksLeft: 1,
          sections: [{ taskDone: false }],
          state: { instances: [{ columns: [{ instances: [{ saved: 'nested' }] }] }] },
        },
      ],
    };
    const seenXAPISources = [];
    harness.H5P.externalDispatcher.on('xAPI', function () { seenXAPISources.push(this); });
    const book = new harness.InteractiveBook(config, '42', {
      metadata: { title: 'Phase 2A compatibility' },
      previousState,
    });
    const directQuestion = harness.questions.get('question-set-direct');
    const nestedQuestion = harness.questions.get('question-set-nested');
    const directColumn = book.chapters[0].instance;
    const nestedColumn = book.chapters[1].instance;
    const row = nestedColumn.getInstances()[0];
    const directColumnVerbs = [];
    const nestedColumnVerbs = [];
    const bookCompletion = [];
    directColumn.on('xAPI', (event) => directColumnVerbs.push(event.getVerb()));
    nestedColumn.on('xAPI', (event) => nestedColumnVerbs.push(event.getVerb()));
    book.on('bookCompleted', (event) => bookCompletion.push(event.data.completed));

    assert.equal(harness.runnableCalls.filter(({ content }) => content.library === 'H5P.ColumnPapiJo 1.19').length, 2);
    assert.equal(harness.runnableCalls[0].contentData.parent, harness.window);
    assert.equal(directColumn instanceof harness.H5P.ColumnPapiJo, true);
    assert.equal(nestedColumn instanceof harness.H5P.ColumnPapiJo, true);
    assert.equal(directColumn.getInstances().length, 1);
    assert.equal(directColumn.getInstances()[0], directQuestion);
    assert.equal(nestedColumn.getInstances().length, 1);
    assert.equal(nestedColumn.getInstances()[0], row);
    assert.equal(harness.H5P.ColumnPapiJo.isTask(directQuestion), true);
    assert.equal(harness.H5P.ColumnPapiJo.isTask(nestedQuestion), true);
    assert.equal(book.chapters[0].sections[0].instance, directQuestion);
    assert.equal(book.chapters[1].sections[0].instance, nestedQuestion);
    assert.deepEqual(Array.from(book.chapters, ({ maxTasks, tasksLeft }) => ({ maxTasks, tasksLeft })), [
      { maxTasks: 1, tasksLeft: 1 },
      { maxTasks: 1, tasksLeft: 1 },
    ]);

    assert.equal(directQuestion.contentData.parent, directColumn);
    assert.deepEqual(directQuestion.contentData.previousState, { saved: 'direct' });
    assert.equal(row.contentData.parent, nestedColumn);
    assert.deepEqual(nestedQuestion.contentData.previousState, { saved: 'nested' });
    assert.equal(book.getScore(), 3);
    assert.equal(book.getMaxScore(), 5);
    assert.deepEqual(book.getCurrentState().chapters[0].state.instances[0], {
      restored: { saved: 'direct' },
      answered: false,
    });

    const wrapper = new harness.JQueryWrapper(new FakeElement('div'));
    book.attach(wrapper);
    book.attach(wrapper);
    book.pageContent.initializeChapter(0);
    book.pageContent.initializeChapter(1);
    assert.equal(directQuestion.attachCount, 1);
    assert.equal(row.attachCount, 1);
    assert.equal(nestedQuestion.attachCount, 1);

    const bookResizeBefore = book.triggerCount('resize');
    directQuestion.trigger('resize', { source: 'question-set-direct' });
    assert.equal(book.triggerCount('resize') > bookResizeBefore, true);
    const childResizeBefore = directQuestion.triggerCount('resize');
    book.trigger('resize', { source: 'book' });
    assert.equal(directQuestion.triggerCount('resize') > childResizeBefore, true);

    directQuestion.answer();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(book.chapters[0].sections[0].taskDone, true);
    assert.equal(book.chapters[0].tasksLeft, 0);
    assert.equal(book.chapters[0].completed, true);
    assert.equal(book.completed, false);
    assert.equal(directColumnVerbs.filter((verb) => verb === 'progressed').length, 1);
    assert.equal(directColumnVerbs.includes('completed'), true);

    book.setActiveChapter(1);
    nestedQuestion.answer();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(book.chapters[1].sections[0].taskDone, true);
    assert.equal(book.chapters[1].tasksLeft, 0);
    assert.equal(book.chapters[1].completed, true);
    assert.equal(book.completed, true);
    assert.deepEqual(bookCompletion, [true]);
    assert.equal(nestedColumnVerbs.filter((verb) => verb === 'progressed').length, 1);
    assert.equal(nestedColumnVerbs.includes('completed'), true);
    assert.equal(seenXAPISources.includes(directQuestion), true);
    assert.equal(seenXAPISources.includes(nestedQuestion), true);
    assert.deepEqual(book.getXAPIData().statement.result.score, { raw: 3, max: 5 });
  }
);

test(
  'Summary does not ask real ColumnPapiJo 1.19 for nested state before attachment',
  { skip: !columnPath ? 'H5P.ColumnPapiJo 1.19 source is unavailable' : false },
  () => {
    const harness = createCompatibilityHarness();
    const questionContent = {
      library: 'H5P.QuestionSetPapiJo 1.22',
      subContentId: 'detached-question-set',
      params: {},
    };
    const column = new harness.H5P.ColumnPapiJo({
      content: [{ content: questionContent }],
    }, '42', {});
    const question = harness.questions.get('detached-question-set');
    let stateReadCount = 0;
    question.getCurrentState = () => {
      stateReadCount++;
      if (question.attachCount === 0) {
        throw new TypeError("can't access property 'hasClass', element.$ is undefined");
      }
      return { attached: true };
    };
    harness.document.querySelectorAll = () => [];
    harness.H5P.Components = { Button: () => new FakeElement('button') };
    const Summary = loadProductionClass('src/scripts/summary.js', 'Summary', {
      H5P: harness.H5P,
      document: harness.document,
      setTimeout,
    }).Class;
    const parent = new harness.H5P.EventDispatcher();
    parent.isAnswerUpdated = true;
    parent.isSubmitButtonEnabled = false;
    const chapter = {
      instance: column,
      isInitialized: false,
      isSummary: false,
      sections: [{ taskDone: false }],
    };
    const summary = new Summary({ behaviour: {}, l10n: {} }, parent, [chapter]);
    summary.wrapper = new FakeElement('div');

    assert.doesNotThrow(() => summary.addActionButtons());
    assert.equal(stateReadCount, 0);

    column.attach(new harness.JQueryWrapper(new FakeElement('div')));
    chapter.isInitialized = true;
    summary.checkTheAnswerIsUpdated();
    assert.equal(stateReadCount, 1);
    assert.deepEqual(JSON.parse(summary.tempState)[0].state.instances[0], { attached: true });
  },
);

test(
  'automatic state saving skips uninitialized real ColumnPapiJo chapters on later-page reload',
  { skip: !columnPath ? 'H5P.ColumnPapiJo 1.19 source is unavailable' : false },
  () => {
    const harness = createCompatibilityHarness();
    const questionContent = (id) => ({
      library: 'H5P.QuestionSetPapiJo 1.22',
      subContentId: id,
      params: {},
    });
    const config = minimalConfig(0);
    config.behaviour.displaySummary = true;
    config.chapters = [
      chapter('Earlier one', 'column-earlier-one', [{ content: questionContent('question-earlier-one') }]),
      chapter('Earlier two', 'column-earlier-two', [{ content: questionContent('question-earlier-two') }]),
      chapter('Reloaded later', 'column-reloaded-later', [{ content: questionContent('question-reloaded-later') }]),
    ];
    const savedChapter = (id) => ({
      completed: false,
      sections: [{ taskDone: false }],
      state: { instances: [{ saved: id }] },
      tasksLeft: 1,
    });
    const earlierWithoutSavedState = savedChapter('earlier-two');
    delete earlierWithoutSavedState.state;
    const previousState = {
      chapters: [
        savedChapter('earlier-one'),
        earlierWithoutSavedState,
        savedChapter('reloaded-later'),
      ],
      maxScore: 6,
      score: 3,
      urlFragments: {
        chapter: 'h5p-interactive-book-chapter-column-reloaded-later',
        h5pbookid: '42',
      },
    };
    harness.window.__fragments = { ...previousState.urlFragments };
    const book = new harness.InteractiveBook(config, '42', {
      metadata: { title: 'Later-page state save' },
      previousState,
    });
    const earlierQuestions = [
      harness.questions.get('question-earlier-one'),
      harness.questions.get('question-earlier-two'),
    ];
    const laterQuestion = harness.questions.get('question-reloaded-later');
    const prematureReads = { maxScore: 0, score: 0, state: 0 };
    earlierQuestions.forEach((question) => {
      question.getCurrentState = () => {
        prematureReads.state++;
        return { unexpectedlyRead: true };
      };
      question.getMaxScore = () => {
        prematureReads.maxScore++;
        throw new TypeError('this.cloze is undefined');
      };
      question.getScore = () => {
        prematureReads.score++;
        throw new TypeError('this.cloze is undefined');
      };
    });
    const initializedReads = { maxScore: 0, score: 0, state: 0 };
    laterQuestion.getCurrentState = () => {
      initializedReads.state++;
      return { attached: true };
    };
    laterQuestion.getMaxScore = () => {
      initializedReads.maxScore++;
      return 2;
    };
    laterQuestion.getScore = () => {
      initializedReads.score++;
      return 1;
    };
    harness.H5P.storeCurrentState = (instance) => instance.getCurrentState();

    assert.deepEqual(Array.from(book.chapters.slice(0, 3), ({ isInitialized }) => isInitialized), [false, false, true]);
    let storedState;
    assert.doesNotThrow(() => {
      storedState = harness.H5P.storeCurrentState(book);
    });
    assert.deepEqual(prematureReads, { maxScore: 0, score: 0, state: 0 });
    assert.deepEqual(initializedReads, { maxScore: 1, score: 1, state: 1 });
    assert.deepEqual(storedState.chapters[0].state, previousState.chapters[0].state);
    assert.equal(storedState.chapters[1].state, null);
    assert.deepEqual(storedState.chapters[2].state.instances[0], { attached: true });
    assert.equal(storedState.score, 1);
    assert.equal(storedState.maxScore, 2);
  },
);

test(
  'Reset Session defers nested resets until real ColumnPapiJo chapters are attached',
  { skip: !columnPath ? 'H5P.ColumnPapiJo 1.19 source is unavailable' : false },
  () => {
    const harness = createCompatibilityHarness();
    const questionContent = (id) => ({
      library: 'H5P.QuestionSetPapiJo 1.22',
      subContentId: id,
      params: {},
    });
    const config = minimalConfig(0);
    config.behaviour.displaySummary = true;
    config.chapters = Array.from({ length: 4 }, (_, index) => chapter(
      `Chapter ${index + 1}`,
      `column-reset-${index + 1}`,
      [{ content: questionContent(`question-reset-${index + 1}`) }],
    ));
    const previousState = {
      chapters: Array.from({ length: 4 }, (_, index) => ({
        completed: true,
        sections: [{ taskDone: true }],
        state: { instances: [{ answers: [{ saved: index + 1 }] }] },
        tasksLeft: 0,
      })),
      maxScore: 8,
      score: 4,
      urlFragments: {
        chapter: 'h5p-interactive-book-chapter-column-reset-4',
        h5pbookid: '42',
      },
    };
    harness.window.__fragments = { ...previousState.urlFragments };
    const book = new harness.InteractiveBook(config, '42', {
      metadata: { title: 'Deferred Reset Session' },
      previousState,
    });
    book.attach(new harness.JQueryWrapper(new FakeElement('div')));
    const questions = Array.from({ length: 4 }, (_, index) =>
      harness.questions.get(`question-reset-${index + 1}`));
    const resetErrors = [];
    const resetCalls = [0, 0, 0, 0];
    questions.forEach((question, index) => {
      question.answered = true;
      question.getScore = () => question.answered ? 1 : 0;
      question.resetTask = () => {
        resetCalls[index]++;
        try {
          if (question.attachCount === 0) {
            throw new TypeError('nested reset requires attachment');
          }
          question.answered = false;
          question.contentData.previousState = {};
        }
        catch (error) {
          resetErrors.push('subcontent does not contain a valid resetTask function');
          resetErrors.push(error.message);
        }
      };
    });

    assert.deepEqual(Array.from(book.chapters.slice(0, 4), ({ isInitialized }) => isInitialized), [false, false, false, true]);
    assert.equal(book.getScore(), 1);
    assert.doesNotThrow(() => book.resetTask());
    assert.deepEqual(resetErrors, []);
    assert.deepEqual(Array.from(book.chapters.slice(0, 4), ({ isInitialized }) => isInitialized), [true, true, false, true]);
    assert.deepEqual(resetCalls, [1, 1, 0, 1]);
    assert.equal(book.chapters[2].resetPending, true);
    assert.deepEqual(Object.keys(previousState), []);
    assert.equal(book.getScore(), 0);

    const stateAfterReset = harness.H5P.storeCurrentState
      ? harness.H5P.storeCurrentState(book)
      : book.getCurrentState();
    assert.equal(stateAfterReset.chapters[2].state, null);

    book.pageContent.initializeChapter(2);
    assert.equal(book.chapters[2].isInitialized, true);
    assert.equal(book.chapters[2].resetPending, false);
    assert.equal(questions[2].attachCount, 1);
    assert.equal(resetCalls[2], 1);
    assert.equal(questions[2].answered, false);
    assert.deepEqual(questions[2].contentData.previousState, {});
    assert.deepEqual(resetErrors, []);
  },
);
