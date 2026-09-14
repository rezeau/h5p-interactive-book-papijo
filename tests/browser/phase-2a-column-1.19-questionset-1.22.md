# Phase 2A ColumnPapiJo 1.19 / QuestionSetPapiJo 1.22 smoke test

Use a manually prepared development fixture with this exact dependency chain:

- `H5P.InteractiveBookPapiJo 1.15.0` source under test;
- `H5P.ColumnPapiJo 1.19.0` pages;
- one direct `H5P.QuestionSetPapiJo 1.22.1` task;
- one `H5P.QuestionSetPapiJo 1.22.1` task nested through `H5P.Row` / `H5P.RowColumn`;
- at least two pages so repeated navigation exercises detach/show/resize behavior.

Do not replace or modify production content automatically. Record the fixture identity, H5P core
version, browser, viewport, and installed library versions.

## Load

1. Load the book in its normal iframe embedding.
2. Confirm both pages render without console errors or missing-library messages.
3. Confirm the direct and Row-nested QuestionSet tasks are visible and usable.

## Score and completion

1. Answer one question in the direct QuestionSet and complete that QuestionSet.
2. Confirm its section and page progress indicators update once.
3. Answer and complete the Row-nested QuestionSet.
4. Confirm the nested section and page update once and the book reaches completion.
5. Record child, Column, and book score/max-score values and the relevant answered/completed xAPI
   statements. Confirm the child events remain visible at book level without duplicate book
   completion.

## Saved state

1. Save or allow the host to persist state after answering both tasks.
2. Reload the same content session.
3. Confirm both QuestionSet answers, the selected page, section progress, page completion,
   total score, and book completion are restored.

## Repeated navigation and resize

1. Navigate page 1 -> page 2 -> page 1 ten times using the normal book controls.
2. Confirm each page still has one Column wrapper and one visible QuestionSet instance.
3. Confirm answers, scores, and completion remain unchanged.
4. At desktop and narrow mobile widths, confirm the active page remains fully visible and the
   iframe height settles without clipping, stale whitespace, flicker, recursion, or console errors.

Stop if this specific chain exposes a concrete regression and retain the minimal reproduction.
Do not expand this smoke test into the earlier general resize/listener investigation.
