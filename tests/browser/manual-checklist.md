# H5P.InteractiveBookPapiJo 1.14.2 browser characterization checklist

Use the existing H5P development environment and the current junction. Do not rebuild or modify the library while recording this baseline.

## Test fixtures needed

An existing local fixture is available at `C:\my_first_h5p_environment\content\ib-pj-001`:

- two `H5P.ColumnPapiJo 1.17` chapters;
- one `H5P.TrueFalse 1.8` child and one `H5P.DialogcardsPapiJo 1.17` child;
- cover, summary, automatic progress, retry, and default table of contents enabled;
- a saved state marking both chapters complete, while the second child state still reports `taskFinished: false`;
- its content-level `h5p.json` says `embedTypes: ["div"]`, while the library manifest says `embedTypes: ["iframe"]`; characterize both the actual development rendering mode and packaged iframe behavior.

Additional fixtures are still needed for the cases below.

1. One unscored chapter.
2. Two chapters containing one scored task each.
3. An empty/unscored chapter followed by a scored chapter.
4. A chapter with a task nested inside `H5P.Row` / `H5P.RowColumn`.
5. A book with cover, summary, submit, and restart enabled.
6. A saved completed state and a saved incomplete state.

## Lifecycle and DOM

- Load each fixture in iframe embedding.
- Record root classes, header/footer/sidebar placement, active chapter class, and initial focus.
- Confirm chapter zero is initially active unless a valid URL/saved fragment selects another chapter.
- Reload and confirm the selected chapter and child state restore.
- Record behavior for an invalid chapter fragment.

## Navigation and accessibility

- Navigate first → next → previous → last through the status bar.
- Navigate directly through the sidebar.
- Repeat navigation ten times.
- Record `aria-expanded`, active-page styling, focus destination, scroll position, and inactive chapter visibility after every path.
- Try the first-page previous and last-page next controls.

## Resize instrumentation

In browser developer tools, count without altering production source:

- Interactive Book `resize` events.
- Active ColumnPapiJo `resize` events.
- `requestAnimationFrame` callbacks attributable to the book.
- `transitionend` listeners/effects after repeated sidebar toggles.

Run these sequences:

1. Trigger one child resize.
2. Trigger one H5P core resize.
3. Toggle the sidebar open/closed 1, 5, and 10 times, then perform one transition.
4. Navigate repeatedly between differently sized chapters.
5. Enter and exit fullscreen five times.
6. Resize through widths below 43em ratio, between 43 and 60, and at/above 60.

Record recursion, duplicate propagation, storms, oscillation, stale height, clipping, truncation, and delayed layout changes. Pay particular attention to the missing `isBubblingUpToCore` / `isBubblingUpToCoreNo2` guard.

## State, scoring, and xAPI

- Record `getCurrentState()` before interaction, on chapter zero after answering, after navigating, after completion, and after restart.
- Confirm child ColumnPapiJo state is restored per chapter.
- Record score/max score for scored, unscored, mixed, nested Row, incomplete, and completed books.
- Capture child answered/completed xAPI events and the book's scored/completed event.
- Confirm repeated completion does not duplicate scored/completed statements.
- Confirm restart resets child state, progress indicators, URL fragment, score, completion, and activity start time.
- Inspect xAPI context/parent relationships for chapter children.

## Cover, summary, submit, and fullscreen

- Confirm the Components CoverPage starts the book and transfers focus to the header progress control.
- Confirm summary totals and unanswered filtering.
- Confirm submit appears only under the current scoring/reporting conditions; there is no `displaySubmit` author setting.
- Confirm restart availability follows `enableRetry`.
- Confirm active chapter, sidebar state, scroll position, dimensions, and focus survive fullscreen entry/exit.

## Evidence to retain

- Fixture identity and content JSON version.
- Browser, viewport, H5P core version, and library versions.
- Event counts for each resize sequence.
- State JSON and xAPI statements with personal data removed.
- Screenshots only where they demonstrate layout, focus, clipping, or stale dimensions.
