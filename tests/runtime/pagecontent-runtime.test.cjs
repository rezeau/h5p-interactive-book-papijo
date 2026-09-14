'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EventDispatcher,
  FakeChild,
  FakeDocument,
  FakeElement,
  FakeWindow,
  createBaseH5P,
  loadProductionClass,
  minimalConfig,
} = require('./helpers/harness.cjs');

function createPageHarness(options = {}) {
  const document = new FakeDocument();
  const window = new FakeWindow();
  const H5P = createBaseH5P();
  const browserSelf = { kind: 'window-self-sentinel' };
  const runnableCalls = [];
  const taskChecks = [];
  const instances = options.instances || [];
  let runnableIndex = 0;
  let fragments = options.fragments || {};

  H5P.newRunnable = (chapter, contentId, wrapper, skipResize, instanceContentData) => {
    const instance = instances[runnableIndex++];
    runnableCalls.push({ chapter, contentId, wrapper, skipResize, instanceContentData, instance });
    return instance;
  };
  H5P.ColumnPapiJo = {
    isTask(instance) {
      taskChecks.push(instance);
      return instance.spec.isTask === true;
    },
  };

  class Summary extends EventDispatcher {
    constructor(config, parent, chapters) {
      super();
      this.config = config;
      this.parent = parent;
      this.chapters = chapters;
      this.addCount = 0;
      this.setCount = 0;
    }

    addSummaryPage() {
      this.addCount++;
    }

    setChapters(chapters) {
      this.chapters = chapters;
      this.setCount++;
    }
  }
  const URLTools = {
    extractFragmentsFromURL() {
      return { ...fragments };
    },
  };

  const loaded = loadProductionClass('src/scripts/pagecontent.js', 'PageContent', {
    H5P,
    URLTools,
    Summary,
    document,
    window,
    self: browserSelf,
    setTimeout(handler) {
      handler();
      return 1;
    },
  });

  class Parent extends EventDispatcher {
    constructor() {
      super();
      this.contentId = '42';
      this.activeChapter = 0;
      this.activeChapterChanges = [];
      this.bubbleRegistrations = [];
      this.validateFragments = () => true;
      this.hashWindow = window;
      this.mainWrapper = { get: () => new FakeElement('div') };
      this.sideBar = { redirectHandler() {} };
      this.progressUpdates = [];
    }

    hasValidChapters() {
      return options.hasValidChapters !== false;
    }

    hasSummary() {
      return options.hasSummary === true;
    }

    hasCover() {
      return false;
    }

    getActiveChapter() {
      return this.activeChapter;
    }

    setActiveChapter(index) {
      this.activeChapter = index;
      this.activeChapterChanges.push(index);
    }

    bubbleUp(origin, eventName, target) {
      this.bubbleRegistrations.push({ origin, eventName, target });
    }

    updateChapterProgress(chapterId, changed) {
      this.progressUpdates.push({ chapterId, changed });
    }
  }

  return {
    PageContent: loaded.Class,
    Parent,
    H5P,
    browserSelf,
    document,
    runnableCalls,
    setFragments(value) {
      fragments = value;
    },
    taskChecks,
    window,
  };
}

function chapterConfig(title, content) {
  return {
    metadata: { title },
    subContentId: title.toLowerCase().replace(/\s+/g, '-'),
    params: { content },
  };
}

test('chapter creation passes browser self as parent and chapter-specific previousState', () => {
  const section1 = new FakeChild({ subContentId: 'task-1', machineName: 'H5P.MultiChoice', isTask: true, answerGiven: true });
  const section2 = new FakeChild({ subContentId: 'text-2', machineName: 'H5P.AdvancedText', isTask: false });
  const column1 = new FakeChild({ subContentId: 'column-1', instances: [section1], renderedSections: 1 });
  const column2 = new FakeChild({ subContentId: 'column-2', instances: [section2], renderedSections: 1 });
  const harness = createPageHarness({ instances: [column1, column2] });
  const parent = new harness.Parent();
  const config = minimalConfig(0);
  config.chapters = [
    chapterConfig('One', [{ content: { library: 'H5P.MultiChoice 1.16', params: {} } }]),
    chapterConfig('Two', [{ content: { library: 'H5P.AdvancedText 1.1', params: {} } }]),
  ];
  const previousState = {
    chapters: [
      { state: { instances: ['first'] }, completed: true, tasksLeft: 0, sections: [{ taskDone: true }] },
      { state: { instances: ['second'] }, completed: false, tasksLeft: 0, sections: [{ taskDone: false }] },
    ],
  };

  const page = new harness.PageContent(config, '42', { previousState }, parent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });

  assert.equal(harness.runnableCalls.length, 2);
  assert.equal(harness.runnableCalls[0].instanceContentData.parent, harness.browserSelf);
  assert.notEqual(harness.runnableCalls[0].instanceContentData.parent, parent);
  assert.deepEqual(harness.runnableCalls[0].instanceContentData.previousState, { instances: ['first'] });
  assert.deepEqual(harness.runnableCalls[1].instanceContentData.previousState, { instances: ['second'] });
  assert.equal(page.chapters[0].completed, true);
  assert.equal(page.chapters[0].maxTasks, 1);
  assert.equal(page.chapters[0].tasksLeft, 0);
  assert.equal(page.chapters[0].sections[0].taskDone, true);
  assert.equal(column1.attachCount, 1);
  assert.equal(column2.attachCount, 1);
});

test('saved top-section redirect can fire before InteractiveBook status-bar initialization', () => {
  const section = new FakeChild({
    subContentId: 'task-1',
    machineName: 'H5P.MultiChoice',
    isTask: true,
  });
  const column = new FakeChild({
    subContentId: 'column-1',
    instances: [section],
    renderedSections: 1,
  });
  const harness = createPageHarness({
    fragments: {
      h5pbookid: '42',
      chapter: 'h5p-interactive-book-chapter-column-1',
      section: 'top',
    },
    instances: [column],
  });
  const parent = new harness.Parent();
  parent.on('scrollToTop', () => parent.statusBarHeader.wrapper.scrollIntoView());
  const config = minimalConfig(0);
  config.chapters = [
    chapterConfig('One', [{ content: { library: 'H5P.MultiChoice 1.16', params: {} } }]),
  ];

  assert.throws(
    () => new harness.PageContent(config, '42', {}, parent, {
      l10n: { markAsFinished: 'Done' },
      behaviour: config.behaviour,
    }),
    (error) => error.name === 'TypeError' && /wrapper/.test(error.message),
  );
  assert.equal(harness.window.animationFrameCount, 1);
  assert.equal(column.attachCount, 0);
});

test('nested Row and RowColumn instances are flattened before task detection', () => {
  const nestedTask = new FakeChild({ subContentId: 'nested-task', machineName: 'H5P.TrueFalse', isTask: true });
  const rowColumn = new FakeChild({ subContentId: 'row-column', machineName: 'H5P.RowColumn', instances: [nestedTask] });
  const row = new FakeChild({ subContentId: 'row', machineName: 'H5P.Row', instances: [rowColumn] });
  const topColumn = new FakeChild({ subContentId: 'column-row', instances: [row], renderedSections: 1 });
  const harness = createPageHarness({ instances: [topColumn] });
  const parent = new harness.Parent();
  const config = minimalConfig(0);
  config.chapters = [chapterConfig('Nested', [{
    content: {
      library: 'H5P.Row 1.0',
      params: {
        columns: [{
          content: {
            params: {
              content: [{ content: { library: 'H5P.TrueFalse 1.8', params: {} } }],
            },
          },
        }],
      },
    },
  }])];

  const page = new harness.PageContent(config, '42', {}, parent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });

  assert.equal(page.chapters[0].sections.length, 1);
  assert.equal(page.chapters[0].sections[0].instance, nestedTask);
  assert.equal(page.chapters[0].sections[0].isTask, true);
  assert.equal(page.chapters[0].maxTasks, 1);
  assert.equal(page.chapters[0].tasksLeft, 1);
  assert.deepEqual(harness.taskChecks, [nestedTask]);
});

test('valid saved URL selects its chapter; invalid saved URL falls back to chapter zero', () => {
  const columns = [
    new FakeChild({ subContentId: 'column-1', instances: [], renderedSections: 0 }),
    new FakeChild({ subContentId: 'column-2', instances: [], renderedSections: 0 }),
  ];
  const config = minimalConfig(0);
  config.chapters = [chapterConfig('One', []), chapterConfig('Two', [])];

  const validHarness = createPageHarness({
    instances: columns,
    fragments: { chapter: 'h5p-interactive-book-chapter-column-2', h5pbookid: '42' },
  });
  const validParent = new validHarness.Parent();
  new validHarness.PageContent(config, '42', {}, validParent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });
  assert.equal(validParent.activeChapter, 1);

  const invalidColumns = [
    new FakeChild({ subContentId: 'column-1', instances: [], renderedSections: 0 }),
    new FakeChild({ subContentId: 'column-2', instances: [], renderedSections: 0 }),
  ];
  const invalidHarness = createPageHarness({
    instances: invalidColumns,
    fragments: { chapter: 'missing', h5pbookid: '42' },
  });
  const invalidParent = new invalidHarness.Parent();
  new invalidHarness.PageContent(config, '42', {}, invalidParent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });
  assert.equal(invalidParent.activeChapter, 0);
  assert.deepEqual(invalidParent.activeChapterChanges, []);
});

test('a previous state with fewer chapters than current content throws during construction', () => {
  const columns = [
    new FakeChild({ subContentId: 'column-1', instances: [], renderedSections: 0 }),
    new FakeChild({ subContentId: 'column-2', instances: [], renderedSections: 0 }),
  ];
  const harness = createPageHarness({ instances: columns });
  const parent = new harness.Parent();
  const config = minimalConfig(0);
  config.chapters = [chapterConfig('One', []), chapterConfig('Two', [])];
  const previousState = {
    chapters: [{ state: {}, completed: false, tasksLeft: 0, sections: [] }],
  };

  assert.throws(
    () => new harness.PageContent(config, '42', { previousState }, parent, {
      l10n: { markAsFinished: 'Done' },
      behaviour: config.behaviour,
    }),
    (error) => error.name === 'TypeError' && /state/.test(error.message),
  );
});

test('PageContent itself tolerates zero chapters and creates an empty container', () => {
  const harness = createPageHarness({ instances: [], hasValidChapters: false });
  const parent = new harness.Parent();
  const config = minimalConfig(0);
  config.chapters = [];
  const page = new harness.PageContent(config, '42', {}, parent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });

  assert.equal(page.chapters.length, 0);
  assert.equal(page.container.classList.contains('h5p-interactive-book-main'), true);
  assert.equal(page.content.children.length, 0);
});

test('chapter change preloads the target, updates active DOM state, and emits resize', () => {
  const columns = [
    new FakeChild({ subContentId: 'column-1', instances: [], renderedSections: 0 }),
    new FakeChild({ subContentId: 'column-2', instances: [], renderedSections: 0 }),
  ];
  const harness = createPageHarness({ instances: columns });
  const parent = new harness.Parent();
  const redirects = [];
  parent.sideBar.redirectHandler = (chapterId) => redirects.push(chapterId);
  parent.getChapterId = (target) => target.endsWith('column-2') ? 1 : 0;
  const config = minimalConfig(0);
  config.chapters = [chapterConfig('One', []), chapterConfig('Two', [])];
  const page = new harness.PageContent(config, '42', {}, parent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });

  page.changeChapter(false, {
    chapter: 'h5p-interactive-book-chapter-column-2',
    section: 'top',
  });

  assert.equal(parent.activeChapter, 1);
  assert.deepEqual(parent.progressUpdates, [{ chapterId: 0, changed: true }]);
  assert.deepEqual(redirects, [1]);
  assert.equal(page.columnNodes[0].classList.contains('h5p-interactive-book-current'), false);
  assert.equal(page.columnNodes[1].classList.contains('h5p-interactive-book-current'), true);
  assert.equal(parent.triggerCount('resize'), 1);
  assert.equal(parent.triggerCount('scrollToTop'), 1);
});

test('summary is created during chapter construction and preloaded after the first chapter', () => {
  const task = new FakeChild({ subContentId: 'task', machineName: 'H5P.MultiChoice', isTask: true });
  const column = new FakeChild({ subContentId: 'column-1', instances: [task], renderedSections: 1 });
  const harness = createPageHarness({ instances: [column], hasSummary: true });
  const parent = new harness.Parent();
  const config = minimalConfig(0);
  config.behaviour.displaySummary = true;
  config.chapters = [chapterConfig('One', [{ content: { library: 'H5P.MultiChoice 1.16', params: {} } }])];
  config.l10n = { summaryHeader: 'Summary' };
  const page = new harness.PageContent(config, '42', {}, parent, {
    l10n: { markAsFinished: 'Done' },
    behaviour: config.behaviour,
  });

  assert.equal(page.chapters.length, 2);
  assert.equal(page.chapters[1].isSummary, true);
  assert.equal(page.chapters[1].title, 'Summary');
  assert.equal(page.chapters[1].instance.chapters.length, 1);
  assert.equal(page.chapters[1].instance.addCount, 1);
  assert.equal(page.chapters[1].isInitialized, true);
});
