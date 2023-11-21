import URLTools from './urltools';
import Summary from "./summary";

class PageContent extends H5P.EventDispatcher {
  /**
   * @constructor
   *
   * @param {object} config
   * @param {string} contentId
   * @param {object} contentData
   * @param {object} parent
   * @param {object} params
   */
  constructor(config, contentId, contentData, parent, params) {
    super();
    this.parent = parent;
    this.behaviour = config.behaviour;

    this.params = params;
    this.targetPage = {};
    this.targetPage.redirectFromComponent = false;

    this.columnNodes = [];
    this.chapters = [];
    this.l10n = config.l10n;
    this.sidebarIsOpen = false;

    // Retrieve previous state
    this.previousState = (contentData.previousState && Object.keys(contentData.previousState).length > 0) ?
      contentData.previousState :
      null;

    if (parent.hasValidChapters()) {
      const startChapter = this.createColumns(config, contentId, contentData);
      this.preloadChapter(startChapter);
    }

    this.content = this.createPageContent();

    this.container = document.createElement('div');
    this.container.classList.add('h5p-interactive-book-main', 'h5p-interactive-book-navigation-hidden');

    this.container.appendChild(this.content);
  }

  /**
   * Get chapters for the page
   *
   * @param {boolean} includeSummary
   * @return {object[]} Chapters.
   */
  getChapters(includeSummary = true) {
    return this.chapters.filter(chapter => !chapter.isSummary || chapter.isSummary && !!includeSummary);
  }

  /**
   * Reset all the chapters
   */
  resetChapters() {
    if (this.behaviour.progressIndicators && !this.behaviour.progressAuto) {
      this.columnNodes.forEach(columnNode => {
        Array.from(columnNode.querySelectorAll('.h5p-interactive-book-status-progress-marker > input[type=checkbox]'))
          .forEach(element => element.checked = false);
      });
    }
  }

  /**
   * Create page content.
   *
   * @return {HTMLElement} Page content.
   */
  createPageContent() {
    const content = document.createElement('div');
    content.classList.add('h5p-interactive-book-content');
    this.columnNodes.forEach(element => {
      content.appendChild(element);
    });

    this.setChapterOrder(this.parent.getActiveChapter());

    return content;
  }

  setChapterOrder(currentId) {
    if (currentId < 0 || currentId > this.columnNodes.length - 1) {
      return;
    }

    this.columnNodes.forEach((element, index) => {
      element.classList.remove('h5p-interactive-book-previous');
      element.classList.remove('h5p-interactive-book-current');
      element.classList.remove('h5p-interactive-book-next');

      if (index === currentId - 1) {
        // element.classList.add('h5p-interactive-book-previous');
      }
      else if (index === currentId) {
        element.classList.add('h5p-interactive-book-current');
      }
      else if (index === currentId + 1) {
        // element.classList.add('h5p-interactive-book-next');
      }
    });
  }

  /**
   * Create page read checkbox.
   *
   * @param {boolean} checked True, if box should be checked.
   * @return {HTMLElement} Checkbox for marking a chapter as read.
   */
  createChapterReadCheckbox(checked) {
    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = checked;
    checkbox.onclick = (event) => {
      this.parent.setChapterRead(undefined, event.target.checked);
    };

    const checkText = document.createElement('p');
    checkText.innerHTML = this.params.l10n.markAsFinished;

    const wrapper = document.createElement('label');
    wrapper.classList.add('h5p-interactive-book-status-progress-marker');
    wrapper.appendChild(checkbox);
    wrapper.appendChild(checkText);

    return wrapper;
  }

  /**
   * Inject section instance UUID into DOM.
   *
   * @param {object[]} sections Sections.
   * @param {HTMLElement} columnNode Column element.
   */
  injectSectionId(sections, columnNode) {
    const columnContent = columnNode.getElementsByClassName('h5p-column-content');

    for (let i = 0; i < sections.length; i++) {
      columnContent[i].id = `h5p-interactive-book-section-${sections[i].instance.subContentId}`;
    }
  }

  /**
   * Preload current chapter and the next one
   * @param {number} chapterIndex
   */
  preloadChapter(chapterIndex) {
    this.initializeChapter(chapterIndex);
    this.initializeChapter(chapterIndex + 1);
  }

  /**
   * Initialize chapter
   * @param {number} chapterIndex
   */
  initializeChapter(chapterIndex) {
    // Out of bound
    if (chapterIndex < 0 || chapterIndex > this.chapters.length - 1) {
      return;
    }

    const chapter = this.chapters[chapterIndex];
    if ( chapter.isSummary) {
      const columnNode = this.columnNodes[chapterIndex];

      if (chapter.isInitialized) {
        chapter.instance.setChapters(this.getChapters(false));
        columnNode.innerHTML = "";
      }
      // Attach
      chapter.instance.addSummaryPage(H5P.jQuery(columnNode));
      chapter.isInitialized = true;
      return;
    }
    if (!chapter.isInitialized) {
      const columnNode = this.columnNodes[chapterIndex];

      // Attach
      chapter.instance.attach(H5P.jQuery(columnNode));
      this.injectSectionId(chapter.sections, columnNode);

      if (this.behaviour.progressIndicators && !this.behaviour.progressAuto) {
        const checked = (this.previousState) ?
          this.previousState.chapters[chapterIndex].completed :
          false;
        columnNode.appendChild(this.createChapterReadCheckbox(checked));
      }

      chapter.isInitialized = true;
    }
  }

  /**
   * Create Column instances.
   *
   * @param {object} config Parameters.
   * @param {number} contentId Content id.
   * @param {object} contentData Content data.
   * @return {number} start chapter
   */
  createColumns(config, contentId, contentData) {
    contentData = Object.assign({}, contentData);

    // Restore previous state
    const previousState = (contentData.previousState && Object.keys(contentData.previousState).length > 0) ?
      contentData.previousState :
      null;
    let urlFragments = URLTools.extractFragmentsFromURL(this.parent.validateFragments, this.parent.hashWindow);
    if (Object.keys(urlFragments).length === 0 && contentData && previousState && previousState.urlFragments) {
      urlFragments = previousState.urlFragments;
    }

    const chapters = [];
    this.chapters = chapters;

    // Go through all columns and initialise them
    for (let i = 0; i < config.chapters.length; i++) {
      const columnNode = document.createElement('div');

      const instanceContentData = {
        ...contentData,
        metadata: {
          ...contentData.metadata,
        },
        previousState: (previousState) ? previousState.chapters[i].state : {}
      };
      const newInstance = H5P.newRunnable(config.chapters[i], contentId, undefined, undefined, instanceContentData);
      this.parent.bubbleUp(newInstance, 'resize', this.parent);

      const chapter = {
        isInitialized: false,
        instance: newInstance,
        title: config.chapters[i].metadata.title,
        completed: (previousState) ? previousState.chapters[i].completed : false,
        tasksLeft: (previousState) ? previousState.chapters[i].tasksLeft : 0,
        isSummary: false,
        sections: newInstance.getInstances().map((instance, contentIndex) => ({
          content: config.chapters[i].params.content[contentIndex].content,
          instance: instance,
          isTask: false
        }))
      };

      columnNode.classList.add('h5p-interactive-book-chapter');
      columnNode.id = `h5p-interactive-book-chapter-${newInstance.subContentId}`;

      chapter.maxTasks = 0;
      chapter.tasksLeft = 0;

      // Find sections with tasks and tracks them
      chapter.sections.forEach((section, index) => {
        if (H5P.ColumnPapiJo.isTask(section.instance)) {
          section.isTask = true;
          chapter.maxTasks++;
          chapter.tasksLeft++;

          if (this.behaviour.progressIndicators) {
            section.taskDone = (previousState) ? previousState.chapters[i].sections[index].taskDone : false;
            if (section.taskDone) {
              chapter.tasksLeft--;
            }
          }
        }
      });

      // Register both the HTML-element and the H5P-element
      chapters.push(chapter);
      this.columnNodes.push(columnNode);
    }

    if (this.parent.hasSummary(chapters)) {
      const columnNode = document.createElement('div');
      const newInstance = new Summary({
        ...config,
      },
      this.parent,
      this.getChapters(false)
      );
      this.parent.bubbleUp(newInstance, 'resize', this.parent);

      const chapter = {
        isInitialized: false,
        instance: newInstance,
        title: this.l10n.summaryHeader,
        isSummary: true,
        sections:[],
      };

      columnNode.classList.add('h5p-interactive-book-chapter');
      columnNode.id = `h5p-interactive-book-chapter-summary`;

      chapter.maxTasks = chapter.tasksLeft;
      chapters.push(chapter);
      this.columnNodes.push(columnNode);
    }

    // First chapter or cover page should be visible, except if the URL of previous state says otherwise.
    if (urlFragments.chapter && urlFragments.h5pbookid == this.parent.contentId) {
      const chapterIndex = this.findChapterIndex(urlFragments.chapter);

      if (chapterIndex === -1) {
        // Chapter requested does not exist - do nothing, so that the cover page or first chapter (0 by default) is displayed.
        return 0;
      }
    
      this.parent.setActiveChapter(chapterIndex);
    
      if (urlFragments.section) {
        const headerNumber = urlFragments.headerNumber;
        setTimeout(() => {
          this.redirectSection(urlFragments.section, headerNumber);
          if (this.parent.hasCover()) {
            this.parent.cover.removeCover();
          }
        }, 1000);
      }
    
      return chapterIndex;
    }

    return 0;
  }

  /**
   * Redirect section.
   *
   * @param {string} sectionUUID Section UUID or top.
   * @param {number} headerNumber Header index within section
   */
  redirectSection(sectionUUID, headerNumber = null) {
    if (sectionUUID === 'top') {
      this.parent.trigger('scrollToTop');
    }
    else {
      let section = document.getElementById(sectionUUID);

      if (section) {
        if (headerNumber !== null) {
          // find header within section
          const headers = section.querySelectorAll('h2, h3');
          if (headers[headerNumber]) {
            // Set section to the header
            section = headers[headerNumber];
          }
        }

        const focusHandler = document.createElement('div');
        focusHandler.setAttribute('tabindex', '-1');
        section.parentNode.insertBefore(focusHandler, section);
        focusHandler.focus();

        focusHandler.addEventListener('blur', () => {
          focusHandler.parentNode.removeChild(focusHandler);
        });

        this.targetPage.redirectFromComponent = false;
        setTimeout(() => {
          section.scrollIntoView(true);
        }, 100);
      }
    }
  }

  /**
   * Find chapter index.
   *
   * @param {string} chapterUUID Chapter UUID.
   * @return {number} Chapter id.
   */
  findChapterIndex(chapterUUID) {
    let position = -1;
    this.columnNodes.forEach((element, index) => {
      if (position !== -1) {
        return; // Skip
      }
      if (element.id === chapterUUID) {
        position = index;
      }
    });

    return position;
  }

  /**
   * Change chapter.
   *
   * @param {boolean} redirectOnLoad True if should redirect on load.
   * @param {object} target Target.
   */
  changeChapter(redirectOnLoad, target) {
    if (this.columnNodes[this.parent.getActiveChapter()].classList.contains('h5p-interactive-book-animate')) {
      return;
    }

    this.targetPage = target;
    const chapterIdOld = this.parent.getActiveChapter();
    const chapterIdNew = this.parent.getChapterId(this.targetPage.chapter);
    const hasChangedChapter = chapterIdOld !== chapterIdNew;

    if (!redirectOnLoad) {
      this.parent.updateChapterProgress(chapterIdOld, hasChangedChapter);
    }

    this.preloadChapter(chapterIdNew);

    if (chapterIdNew < this.columnNodes.length) {
      const oldChapter = this.columnNodes[chapterIdOld];
      const targetChapter = this.columnNodes[chapterIdNew];

      if (hasChangedChapter && !redirectOnLoad) {
        this.parent.setActiveChapter(chapterIdNew);

        const direction = (chapterIdOld < chapterIdNew) ? 'next' : 'previous';

        /*
         * Animation done by making the current and the target node
         * visible and then applying the correct translation in x-direction
         */
        targetChapter.classList.add(`h5p-interactive-book-${direction}`);

        targetChapter.classList.add('h5p-interactive-book-animate');
        oldChapter.classList.add('h5p-interactive-book-animate');

        // Start the animation
        setTimeout(() => {
          if (direction === 'previous') {
            oldChapter.classList.add('h5p-interactive-book-next');
          }
          else {
            oldChapter.classList.remove('h5p-interactive-book-current');
            oldChapter.classList.add('h5p-interactive-book-previous');
          }
          targetChapter.classList.remove(`h5p-interactive-book-${direction}`);
        }, 1);

        // End the animation
        setTimeout(() => {
          oldChapter.classList.remove('h5p-interactive-book-next');
          oldChapter.classList.remove('h5p-interactive-book-previous');

          oldChapter.classList.remove('h5p-interactive-book-current');
          targetChapter.classList.add('h5p-interactive-book-current');

          targetChapter.classList.remove('h5p-interactive-book-animate');
          oldChapter.classList.remove('h5p-interactive-book-animate');

          this.redirectSection(this.targetPage.section, this.targetPage.headerNumber);

          this.parent.trigger('resize');
        }, 250);
      }
      else {
        if (this.parent.cover && !this.parent.cover.hidden) {
          this.parent.on('coverRemoved', () => {
            this.redirectSection(this.targetPage.section, this.targetPage.headerNumber);
          });
        }
        else {
          this.redirectSection(this.targetPage.section, this.targetPage.headerNumber);
        }
      }

      this.parent.sideBar.redirectHandler(chapterIdNew);
    }
  }

  /**
   * Update footer.
   */
  updateFooter() {
    if ( this.chapters.length === 0) {
      return;
    }
    const activeChapter = this.parent.getActiveChapter();
    const column = this.columnNodes[activeChapter];
    const moveFooterInsideContent = this.parent.shouldFooterBeHidden(column.clientHeight);

    // Move status bar footer to content in fullscreen
    const footerParent = this.parent.statusBarFooter.wrapper.parentNode;
    if (moveFooterInsideContent) {
      // Add status bar footer to page content
      if (footerParent !== this.content) {
        this.content.appendChild(this.parent.statusBarFooter.wrapper);
      }
    }
    else {
      // Re-attach to shared bottom of book when exiting fullscreen
      if (footerParent !== this.parent.$wrapper) {
        this.parent.$wrapper.append(this.parent.statusBarFooter.wrapper);
      }
    }
  }

  /**
   * Toggle the navigation menu.
   */
  toggleNavigationMenu() {
    const self = this;
    if (!this.sidebarIsOpen) {
      this.container.classList.remove('h5p-interactive-book-navigation-hidden');
      setTimeout(function () {
        self.container.classList.add('h5p-interactive-book-navigation-open');
      }, 1);
    }
    else {
      // Wait for the tranistion to end before hiding it completely
      H5P.Transition.onTransitionEnd(H5P.jQuery(this.container), function () {
        self.container.classList.add('h5p-interactive-book-navigation-hidden');
      }, 500);
      this.container.classList.remove('h5p-interactive-book-navigation-open');
    }

    this.sidebarIsOpen = !this.sidebarIsOpen;
  }
}

export default PageContent;
