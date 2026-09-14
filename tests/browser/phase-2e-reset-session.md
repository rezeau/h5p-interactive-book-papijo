# InteractiveBookPapiJo 1.15.0 lifecycle browser verification

Completed in the H5P CLI browser with an InteractiveBookPapiJo 1.15.0 fixture containing
multiple task and non-task pages, QuestionSetPapiJo 1.22.1 content with AdvancedBlanksPapiJo and
DragQuestionPapiJo, and a Summary page. The rebuilt production bundle was used and the browser
console remained open throughout.

- [x] Verify normal load and direct reload into middle and last normal pages.
- [x] Reload directly into a text/image-only page.
- [x] Reload directly into QuestionSetPapiJo pages containing AdvancedBlanksPapiJo and
  DragQuestionPapiJo.
- [x] Allow passive autosave after each direct reload without further user action.
- [x] Open Summary after direct reload and verify score and completion display.
- [x] Run Reset Session immediately after direct reload and confirm answers, score, completion,
  and progress are cleared.
- [x] Visit pages that were uninitialized when Reset Session ran and confirm stale answers and
  progress are not restored.
- [x] Reload/resume after reset and confirm the clean state persists.
- [x] Confirm the console contains no premature `getScore`, `getMaxScore`, or `getCurrentState`
  errors; no `this.cloze is undefined`; no invalid `resetTask`; no progress-dot error; and no
  `statusBarHeader` error.

The synthetic status-bar initialization characterization remains intentionally unfixed because
it did not reproduce during real browser verification.
