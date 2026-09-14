'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EventDispatcher,
  FakeChild,
  FakeDocument,
  FakeElement,
  FakeJQuery,
  FakeWindow,
  contentData,
  createBaseH5P,
  loadProductionClass,
  minimalConfig,
} = require('./helpers/harness.cjs');

function createAppHarness() {
  const document = new FakeDocument();
  const window = new FakeWindow();
  const H5P = createBaseH5P();

  class PageContent extends EventDispatcher {
    constructor(config, contentId, childContentData, parent, params) {
      super();
      PageContent.lastConstruction = { config, contentId, childContentData, parent, params };
      this.parent = parent;
      this.container = new FakeElement('main');
      this.content = new FakeElement('div');
      this.content.classList.add('h5p-interactive-book-content');
      this.container.appendChild(this.content);
      this.sidebarIsOpen = false;
      this.changeChapterCalls = [];
      this.resetCount = 0;
      this.chapters = config.chapters.map((chapter, index) => {
        const spec = config.__runtimeSpecs?.[index] || {};
        const instance = spec.instance || new FakeChild({
          subContentId: chapter.subContentId || `chapter-${index + 1}`,
          score: spec.score,
          maxScore: spec.maxScore,
          answerGiven: spec.answerGiven,
          state: spec.state,
          xAPIData: spec.xAPIData,
        });
        parent.bubbleUp(instance, 'resize', parent);
        return {
          completed: spec.completed || false,
          instance,
          isInitialized: true,
          isSummary: false,
          maxTasks: spec.maxTasks || 0,
          sections: spec.sections || [],
          tasksLeft: spec.tasksLeft || 0,
          title: chapter.metadata.title,
        };
      });
      this.columnNodes = this.chapters.map((chapter) => {
        const node = new FakeElement('section');
        node.id = `h5p-interactive-book-chapter-${chapter.instance.subContentId}`;
        return node;
      });
    }

    getChapters() {
      return this.chapters;
    }

    toggleNavigationMenu() {
      this.sidebarIsOpen = !this.sidebarIsOpen;
    }

    changeChapter(redirectOnLoad, handler) {
      this.changeChapterCalls.push({ redirectOnLoad, handler });
    }

    resetChapters() {
      this.resetCount++;
    }
  }

  class SideBar {
    constructor() {
      this.container = new FakeElement('nav');
      this.progressUpdates = [];
      this.sectionMarkers = [];
      this.focusCount = 0;
      this.resetCount = 0;
    }

    updateChapterProgressIndicator(chapterId, status) {
      this.progressUpdates.push({ chapterId, status });
    }

    setSectionMarker(chapterId, sectionId) {
      this.sectionMarkers.push({ chapterId, sectionId });
    }

    resetIndicators() {
      this.resetCount++;
    }

    redirectHandler() {}

    focus() {
      this.focusCount++;
    }
  }

  class StatusBar {
    constructor() {
      this.wrapper = new FakeElement('header');
      this.menuToggleButton = new FakeElement('button');
      this.progressBar = { progress: new FakeElement('button') };
      this.updateCount = 0;
    }

    updateStatusBar() {
      this.updateCount++;
    }

    isMenuOpen() {
      return this.menuToggleButton.classList.contains('h5p-interactive-book-status-menu-active');
    }
  }

  class Cover {
    constructor() {
      this.container = new FakeElement('div');
      this.hidden = false;
      this.initMediaCount = 0;
    }

    initMedia() {
      this.initMediaCount++;
    }
  }

  const URLTools = {
    extractFragmentsFromURL(validate, hashWindow) {
      return hashWindow.__fragments ? { ...hashWindow.__fragments } : {};
    },
    createFragmentsString(value) {
      return JSON.stringify(value);
    },
    areFragmentsEqual(left, right, keys) {
      return keys.every((key) => left[key] === right[key]);
    },
  };

  const Colors = {
    isBaseColor() {
      return true;
    },
  };
  const tinycolor = () => ({
    clone() { return this; },
    darken() { return this; },
    getBrightness() { return 0; },
    lighten() { return this; },
    toHexString() { return '#000000'; },
  });
  tinycolor.mix = tinycolor;

  const loaded = loadProductionClass('src/scripts/app.js', 'InteractiveBook', {
    Colors,
    Cover,
    DOMException,
    H5P,
    H5PIntegration: {},
    PageContent,
    SideBar,
    StatusBar,
    URLTools,
    document,
    self: window,
    setTimeout(handler) {
      handler();
      return 1;
    },
    tinycolor,
    top: window,
    window,
  });

  return {
    InteractiveBook: loaded.Class,
    H5P,
    PageContent,
    document,
    window,
  };
}

function makeChapter(instance, overrides = {}) {
  return {
    completed: false,
    instance,
    isInitialized: true,
    isSummary: false,
    maxTasks: 0,
    sections: [],
    tasksLeft: 0,
    ...overrides,
  };
}

test('constructor establishes defaults, support objects, listeners, and chapters before attach', () => {
  const harness = createAppHarness();
  const config = minimalConfig(2);
  delete config.behaviour.displaySummary;
  const previousState = { marker: 'preserved' };
  const book = new harness.InteractiveBook(config, '77', contentData({ previousState }));

  assert.equal(book.contentId, '77');
  assert.equal(book.previousState, previousState);
  assert.equal(book.activeChapter, 0);
  assert.equal(book.completed, false);
  assert.equal(book.params.behaviour.displaySummary, true);
  assert.equal(book.params.behaviour.enableSolutionsButton, false);
  assert.equal(book.params.behaviour.enableRetry, true);
  assert.equal(book.isSubmitButtonEnabled, false);
  assert.equal(book.chapters.length, 2);
  assert.ok(book.pageContent);
  assert.ok(book.sideBar);
  assert.ok(book.statusBarHeader);
  assert.ok(book.statusBarFooter);
  assert.equal(book.mainWrapper, null);
  assert.equal(book.listenerCount('resize'), 1);
  assert.equal(book.listenerCount('toggleMenu'), 1);
  assert.equal(book.listenerCount('scrollToTop'), 1);
  assert.equal(book.listenerCount('newChapter'), 1);
  assert.equal(harness.H5P.externalDispatcher.listenerCount('xAPI'), 1);
  assert.equal(harness.window.listenerCount('hashchange'), 1);
  assert.equal(harness.PageContent.lastConstruction.childContentData.parent, book);
  assert.equal(harness.PageContent.lastConstruction.childContentData.previousState, previousState);
});

test('constructor scoring flags prefer contentData and fall back to H5PIntegration behavior', () => {
  const harness = createAppHarness();
  const config = minimalConfig(1);
  const reportingBook = new harness.InteractiveBook(config, '1', contentData({ isReportingEnabled: true }));
  assert.equal(reportingBook.isSubmitButtonEnabled, true);

  const disabledBook = new harness.InteractiveBook(minimalConfig(1), '2', contentData({
    isReportingEnabled: false,
    isScoringEnabled: false,
  }));
  assert.equal(disabledBook.isSubmitButtonEnabled, false);
});

test('contentData default is not sufficient because metadata.title is required', () => {
  const harness = createAppHarness();
  assert.throws(
    () => new harness.InteractiveBook(minimalConfig(1), '1'),
    (error) => error.name === 'TypeError' && /metadata|title/.test(error.message),
  );
});

test('attach creates the root layout and repeated attach does not duplicate listeners or nodes', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(2), '1', contentData());
  const wrapper = new FakeJQuery(new FakeElement('div'));

  book.attach(wrapper);
  const listenersBefore = {
    resize: book.listenerCount('resize'),
    toggleMenu: book.listenerCount('toggleMenu'),
    xAPI: harness.H5P.externalDispatcher.listenerCount('xAPI'),
  };
  const rootChildren = wrapper[0].children.slice();
  assert.equal(wrapper.hasClass('h5p-interactive-book'), true);
  assert.equal(wrapper.hasClass('h5p-scrollable-fullscreen'), true);
  assert.equal(wrapper.hasClass('h5p-theme'), true);
  assert.equal(book.pageContent.container.firstChild, book.sideBar.container);

  book.attach(wrapper);
  assert.deepEqual(wrapper[0].children, rootChildren);
  assert.equal(book.listenerCount('resize'), listenersBefore.resize);
  assert.equal(book.listenerCount('toggleMenu'), listenersBefore.toggleMenu);
  assert.equal(harness.H5P.externalDispatcher.listenerCount('xAPI'), listenersBefore.xAPI);
});

test('sanitization can remove all chapters and attach then throws', () => {
  const harness = createAppHarness();
  const config = minimalConfig(1);
  config.chapters[0].params.content = [{ content: null }];
  const book = new harness.InteractiveBook(config, '1', contentData());
  assert.equal(book.chapters.length, 0);
  assert.throws(
    () => book.attach(new FakeJQuery(new FakeElement('div'))),
    (error) => error.name === 'TypeError' && /isSummary/.test(error.message),
  );
});

test('score, max score, answer-given, and current-state contracts are aggregate and chapter-sensitive', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData());
  const scored = new FakeChild({
    subContentId: 'scored',
    score: 2,
    maxScore: 3,
    answerGiven: true,
    state: { answer: 2 },
  });
  const unscored = new EventDispatcher();
  unscored.subContentId = 'unscored';
  unscored.getCurrentState = () => null;
  const falseAnswer = new FakeChild({
    subContentId: 'false-answer',
    score: 1,
    maxScore: 1,
    answerGiven: false,
    state: {},
  });

  book.chapters = [
    makeChapter(scored, { completed: true, maxTasks: 1, tasksLeft: 0, sections: [{ taskDone: true }] }),
    makeChapter(unscored),
  ];
  assert.equal(book.getScore(), 2);
  assert.equal(book.getMaxScore(), 3);
  assert.equal(book.getAnswerGiven(), true);

  book.activeChapter = 0;
  const firstChapterState = book.getCurrentState();
  assert.equal(Object.hasOwn(firstChapterState, 'score'), false);
  assert.equal(Object.hasOwn(firstChapterState, 'maxScore'), false);
  assert.equal(firstChapterState.chapters[0].completed, true);
  assert.equal(firstChapterState.chapters[0].sections[0].taskDone, true);
  assert.equal(firstChapterState.chapters[1].state, null);

  book.activeChapter = 1;
  const laterChapterState = book.getCurrentState();
  assert.equal(laterChapterState.score, 2);
  assert.equal(laterChapterState.maxScore, 3);

  book.chapters.push(makeChapter(falseAnswer));
  assert.equal(book.getAnswerGiven(), false);
  book.chapters = [];
  assert.equal(book.getAnswerGiven(), true);
});

test('score falls back to previousState only while no chapters exist', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData({
    previousState: { score: 7, maxScore: 9 },
  }));
  book.chapters = [];
  assert.equal(book.getScore(), 7);
  assert.equal(book.getMaxScore(), 9);
});

test('per-chapter and whole-book completion emit scored data only once', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData());
  const first = new FakeChild({ subContentId: 'first', score: 1, maxScore: 2 });
  const second = new FakeChild({ subContentId: 'second', score: 2, maxScore: 2 });
  book.chapters = [makeChapter(first), makeChapter(second)];
  const completionEvents = [];
  book.on('bookCompleted', (event) => completionEvents.push(event.data.completed));

  book.handleChapterCompletion(0);
  assert.equal(first.scoredEvents.length, 1);
  assert.equal(book.completed, false);
  book.handleChapterCompletion(0);
  assert.equal(first.scoredEvents.length, 1);

  book.handleChapterCompletion(1);
  assert.equal(second.scoredEvents.length, 1);
  assert.equal(book.completed, true);
  assert.deepEqual(completionEvents, [true]);

  book.handleChapterCompletion(1);
  assert.equal(second.scoredEvents.length, 1);
  assert.deepEqual(completionEvents, [true]);

  book.handleChapterCompletion(0, false);
  assert.equal(book.completed, false);
  assert.deepEqual(completionEvents, [true, false]);
});

test('xAPI report aggregates book score and child reports; child events update progress once', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData());
  const child = new FakeChild({
    subContentId: 'task-1',
    score: 1,
    maxScore: 2,
    answerGiven: true,
    state: { answer: true },
    xAPIData: { statement: { id: 'child' } },
  });
  book.chapters = [makeChapter(child, {
    maxTasks: 1,
    tasksLeft: 1,
    sections: [{ instance: child, isTask: true, taskDone: false }],
  })];

  const report = book.getXAPIData();
  assert.equal(report.statement.result.score, 1);
  assert.equal(report.statement.result.maxScore, 2);
  assert.equal(report.statement.result.completion, true);
  assert.equal(report.statement.result.success, false);
  assert.deepEqual(report.children, [{ statement: { id: 'child' } }]);

  const event = { getVerb: () => 'answered' };
  harness.H5P.externalDispatcher.emitFrom(child, 'xAPI', event);
  assert.equal(book.chapters[0].sections[0].taskDone, true);
  assert.equal(book.chapters[0].tasksLeft, 0);
  assert.deepEqual(book.sideBar.sectionMarkers, [{ chapterId: 0, sectionId: 0 }]);

  harness.H5P.externalDispatcher.emitFrom(child, 'xAPI', event);
  assert.equal(book.chapters[0].tasksLeft, 0);
  assert.equal(book.sideBar.sectionMarkers.length, 1);
});

test('resize bubbling is finite but core-originated resize reaches the child without the upstream guard', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData());
  const wrapper = new FakeJQuery(new FakeElement('div'));
  book.attach(wrapper);
  const child = book.chapters[0].instance;

  child.trigger('resize');
  assert.equal(harness.window.animationFrameCount, 1);
  assert.equal(child.triggerCount('resize'), 1);

  book.trigger('resize');
  assert.equal(harness.window.animationFrameCount, 3);
  assert.equal(child.triggerCount('resize'), 2);

  book.isBubblingUpToCore = true;
  book.trigger('resize');
  assert.equal(harness.window.animationFrameCount, 5);
  assert.equal(child.triggerCount('resize'), 3);
});

test('each menu toggle adds another persistent transitionend resize listener', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData());
  book.attach(new FakeJQuery(new FakeElement('div')));

  book.trigger('toggleMenu', {});
  book.trigger('toggleMenu', {});
  book.trigger('toggleMenu', {});
  assert.equal(book.sideBar.container.listenerCount('transitionend'), 3);

  const resizeCountBefore = book.triggerCount('resize');
  book.sideBar.container.dispatchEvent('transitionend');
  assert.equal(book.triggerCount('resize') - resizeCountBefore, 6);
});

test('navigation helpers fall back unknown chapter IDs to zero but setActiveChapter has no bounds check', () => {
  const harness = createAppHarness();
  const book = new harness.InteractiveBook(minimalConfig(2), '1', contentData());
  assert.equal(book.getChapterId('h5p-interactive-book-chapter-missing'), 0);
  assert.equal(book.getChapterId(`h5p-interactive-book-chapter-${book.chapters[1].instance.subContentId}`), 1);

  book.setActiveChapter('1');
  assert.equal(book.activeChapter, 1);
  book.setActiveChapter('not-a-number');
  assert.equal(book.activeChapter, 1);
  book.setActiveChapter('999');
  assert.equal(book.activeChapter, 999);
});

test('reset clears child/book progress, saved fallback state, hash, and answer-updated state', () => {
  const harness = createAppHarness();
  const previousState = { score: 3, maxScore: 4, urlFragments: { chapter: 'old' } };
  const book = new harness.InteractiveBook(minimalConfig(1), '1', contentData({ previousState }));
  book.attach(new FakeJQuery(new FakeElement('div')));
  const child = book.chapters[0].instance;
  book.chapters[0].completed = true;
  book.chapters[0].maxTasks = 1;
  book.chapters[0].tasksLeft = 0;
  book.chapters[0].sections = [{ taskDone: true }];
  book.completed = true;
  book.isAnswerUpdated = true;
  book.hashWindow.location.hash = '#old';

  book.resetTask();

  assert.equal(child.resetCount, 1);
  assert.equal(book.chapters[0].completed, false);
  assert.equal(book.chapters[0].tasksLeft, 1);
  assert.equal(book.chapters[0].sections[0].taskDone, false);
  assert.equal(book.completed, false);
  assert.equal(book.isAnswerUpdated, false);
  assert.equal(book.hashWindow.location.hash, '');
  assert.deepEqual(Object.keys(previousState), []);
  assert.equal(book.pageContent.resetCount, 1);
  assert.equal(book.sideBar.resetCount, 1);
  assert.equal(book._activityForce, true);
});

test('cover is shown only without a chapter fragment and cover removal resumes the book', () => {
  const harness = createAppHarness();
  const config = minimalConfig(1);
  config.showCoverPage = true;
  config.bookCover = {};
  const book = new harness.InteractiveBook(config, '1', contentData());
  const wrapper = new FakeJQuery(new FakeElement('div'));
  book.attach(wrapper);

  assert.equal(book.shouldShowCover, true);
  assert.equal(wrapper.hasClass('covered'), true);
  assert.equal(book.cover.initMediaCount, 1);
  assert.equal(book.statusBarHeader.wrapper.classList.contains('h5p-content-hidden'), true);
  assert.equal(book._activityStarted, 0);

  book.trigger('coverRemoved', true);
  assert.equal(book.statusBarHeader.wrapper.classList.contains('h5p-content-hidden'), false);
  assert.equal(book._activityStarted, 1);
  assert.equal(book.statusBarHeader.progressBar.progress.focusCount, 1);
  assert.equal(book.triggerCount('resize') > 0, true);

  const restoredConfig = minimalConfig(1);
  restoredConfig.showCoverPage = true;
  restoredConfig.bookCover = {};
  const restored = new harness.InteractiveBook(restoredConfig, '2', contentData({
    previousState: { urlFragments: { chapter: 'saved' } },
  }));
  assert.equal(restored.shouldShowCover, false);
});
