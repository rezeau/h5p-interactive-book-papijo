'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name) {
    if (this.values.has(name)) {
      this.values.delete(name);
      return false;
    }
    this.values.add(name);
    return true;
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.eventListeners = new Map();
    this.id = '';
    this.checked = false;
    this.hidden = false;
    this.offsetParent = {};
    this.offsetWidth = 800;
    this.scrollTop = 0;
    this.focusCount = 0;
    this.scrollIntoViewCount = 0;
    this._innerHTML = '';
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === '') {
      this.children.forEach((child) => child.parentNode = null);
      this.children = [];
    }
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  appendChild(node) {
    if (node == null) {
      return node;
    }
    if (node.parentNode) {
      const oldIndex = node.parentNode.children.indexOf(node);
      if (oldIndex >= 0) {
        node.parentNode.children.splice(oldIndex, 1);
      }
    }
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  insertBefore(node, reference) {
    if (node.parentNode) {
      const oldIndex = node.parentNode.children.indexOf(node);
      if (oldIndex >= 0) {
        node.parentNode.children.splice(oldIndex, 1);
      }
    }
    const index = this.children.indexOf(reference);
    node.parentNode = this;
    if (index < 0) {
      this.children.push(node);
    }
    else {
      this.children.splice(index, 0, node);
    }
    return node;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(name, handler) {
    const listeners = this.eventListeners.get(name) || [];
    listeners.push(handler);
    this.eventListeners.set(name, listeners);
  }

  listenerCount(name) {
    return (this.eventListeners.get(name) || []).length;
  }

  dispatchEvent(event) {
    const normalized = typeof event === 'string' ? { type: event, target: this } : event;
    (this.eventListeners.get(normalized.type) || []).slice().forEach((handler) => handler(normalized));
  }

  getElementsByClassName(name) {
    const matches = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (child.classList?.contains(name)) {
          matches.push(child);
        }
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  querySelectorAll() {
    return [];
  }

  querySelector() {
    return null;
  }

  focus() {
    this.focusCount++;
  }

  scrollIntoView() {
    this.scrollIntoViewCount++;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement('head');
    this.documentElement = new FakeElement('html');
    this.documentElement.style = { setProperty() {} };
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createTextNode(text) {
    const node = new FakeElement('#text');
    node.textContent = text;
    return node;
  }

  getElementById() {
    return null;
  }
}

class EventDispatcher {
  constructor() {
    this._listeners = new Map();
    this._triggerCounts = new Map();
    this._activityStarted = 0;
  }

  on(name, handler, context) {
    const listeners = this._listeners.get(name) || [];
    listeners.push({ handler, context });
    this._listeners.set(name, listeners);
    return this;
  }

  listenerCount(name) {
    return (this._listeners.get(name) || []).length;
  }

  trigger(name, data) {
    this._triggerCounts.set(name, (this._triggerCounts.get(name) || 0) + 1);
    const event = data && data.type && Object.hasOwn(data, 'data') ? data : { type: name, data };
    (this._listeners.get(name) || []).slice().forEach(({ handler, context }) => {
      handler.call(context || this, event);
    });
    return this;
  }

  triggerCount(name) {
    return this._triggerCounts.get(name) || 0;
  }

  emitFrom(source, name, event) {
    (this._listeners.get(name) || []).slice().forEach(({ handler }) => handler.call(source, event));
  }

  setActivityStarted(force) {
    this._activityStarted++;
    this._activityForce = force;
  }

  createXAPIEventTemplate(verb) {
    return new FakeXAPIEvent(verb);
  }
}

class FakeXAPIEvent {
  constructor(verb) {
    this.verb = verb;
    this.data = { statement: { object: { definition: {} } } };
  }

  getVerifiedStatementValue(pathParts) {
    let value = this.data.statement;
    for (const part of pathParts.slice(1)) {
      value[part] = value[part] || {};
      value = value[part];
    }
    return value;
  }

  setScoredResult(score, maxScore, instance, completion, success) {
    this.scored = { score, maxScore, instance, completion, success };
    this.data.statement.result = this.scored;
  }
}

class FakeWindow {
  constructor() {
    this.location = { hash: '' };
    this.navigator = { userAgent: 'CharacterizationHarness/1.0' };
    this.eventListeners = new Map();
    this.animationFrameCount = 0;
  }

  addEventListener(name, handler) {
    const listeners = this.eventListeners.get(name) || [];
    listeners.push(handler);
    this.eventListeners.set(name, listeners);
  }

  listenerCount(name) {
    return (this.eventListeners.get(name) || []).length;
  }

  requestAnimationFrame(handler) {
    this.animationFrameCount++;
    handler();
  }
}

class FakeJQuery {
  constructor(element = new FakeElement('div')) {
    this[0] = element;
    this.length = 1;
  }

  addClass(...names) {
    names.flatMap((name) => String(name).split(/\s+/)).filter(Boolean).forEach((name) => this[0].classList.add(name));
    return this;
  }

  removeClass(...names) {
    names.flatMap((name) => String(name).split(/\s+/)).filter(Boolean).forEach((name) => this[0].classList.remove(name));
    return this;
  }

  hasClass(name) {
    return this[0].classList.contains(name);
  }

  append(node) {
    this[0].appendChild(node instanceof FakeJQuery ? node[0] : node);
    return this;
  }

  width() {
    return this[0].offsetWidth;
  }

  css(name) {
    return name === 'font-size' ? '16px' : '';
  }

  get(index) {
    return this[index];
  }
}

class FakeChild extends EventDispatcher {
  constructor(spec = {}) {
    super();
    this.spec = spec;
    this.subContentId = spec.subContentId || 'child';
    this.libraryInfo = { machineName: spec.machineName || 'H5P.ColumnPapiJo' };
    this.contentData = spec.contentData;
    this.attachCount = 0;
    this.resetCount = 0;
    this.scoredEvents = [];
  }

  getInstances() {
    return this.spec.instances || [];
  }

  attach(wrapper) {
    this.attachCount++;
    const count = this.spec.renderedSections ?? this.getInstances().length;
    for (let i = 0; i < count; i++) {
      const section = new FakeElement('div');
      section.classList.add('h5p-column-content');
      wrapper[0].appendChild(section);
    }
  }

  getScore() {
    return this.spec.score ?? 0;
  }

  getMaxScore() {
    return this.spec.maxScore ?? 0;
  }

  getAnswerGiven() {
    return this.spec.answerGiven ?? false;
  }

  getCurrentState() {
    return this.spec.state;
  }

  getXAPIData() {
    return this.spec.xAPIData;
  }

  resetTask() {
    this.resetCount++;
  }

  triggerXAPIScored(score, maxScore, verb) {
    this.scoredEvents.push({ score, maxScore, verb });
  }
}

function transformModule(source, exportName) {
  return source
    .replace(/^import .*;\r?\n/gm, '')
    .replace(`export default class ${exportName}`, `class ${exportName}`)
    .replace(new RegExp(`export default ${exportName};?`), '')
    .concat(`\nmodule.exports = ${exportName};\n`);
}

function loadProductionClass(relativePath, exportName, sandboxValues) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    console,
    ...sandboxValues,
  };
  vm.createContext(sandbox);
  vm.runInContext(transformModule(source, exportName), sandbox, { filename: relativePath });
  return { Class: module.exports, sandbox, source };
}

function createBaseH5P() {
  const externalDispatcher = new EventDispatcher();
  return {
    EventDispatcher,
    externalDispatcher,
    isFullscreen: false,
    on(target, name, handler) {
      target.on(name, handler);
    },
    trigger(target, name, data) {
      target.trigger(name, data);
    },
    jQuery(element) {
      return element instanceof FakeJQuery ? element : new FakeJQuery(element);
    },
    Transition: {
      onTransitionEnd(wrapper, handler) {
        handler();
      },
    },
  };
}

function minimalConfig(chapterCount = 1) {
  return {
    chapters: Array.from({ length: chapterCount }, (_, index) => ({
      metadata: { title: `Chapter ${index + 1}` },
      subContentId: `chapter-${index + 1}`,
      params: {
        content: [{
          content: {
            library: 'H5P.AdvancedText 1.1',
            params: {},
          },
        }],
      },
    })),
    behaviour: {
      progressAuto: true,
      progressIndicators: true,
      displaySummary: false,
      defaultTableOfContents: false,
    },
    showCoverPage: false,
    l10n: {},
  };
}

function contentData(overrides = {}) {
  return {
    metadata: { title: 'Characterization Book' },
    ...overrides,
  };
}

module.exports = {
  EventDispatcher,
  FakeChild,
  FakeClassList,
  FakeDocument,
  FakeElement,
  FakeJQuery,
  FakeWindow,
  contentData,
  createBaseH5P,
  loadProductionClass,
  minimalConfig,
  repoRoot,
};
