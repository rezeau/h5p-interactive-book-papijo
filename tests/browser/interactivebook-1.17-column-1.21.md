# InteractiveBookPapiJo 1.17 / ColumnPapiJo 1.21 integration checklist

Run on a dedicated copy after the actual AdvancedTextPapiJo 1.3 candidate is available.
Record H5P core, browser, viewport, content identity, and all installed library versions.
The automated prospective registration is not a replacement for this integration check.

## Required libraries

- InteractiveBookPapiJo 1.17.0 candidate
- Actual prepared ColumnPapiJo 1.21.0
- Actual AdvancedTextPapiJo 1.3 candidate and its required editor libraries
- AccordionPapiJo 1.1.7 for nested Accordion coverage
- QuestionSetPapiJo 1.23 and ScaleQuestion 0.2 where existing content uses them

## Authoring and existing content

1. Create a book with at least two Column 1.21 pages and direct AdvancedText 1.3 children.
   Add AdvancedText 1.3 inside AccordionPapiJo as a deeper nesting case.
2. Edit formatted text, tooltips, and inline/tooltip images; save, reopen the editor, and verify
   that pages and nested children survive with correct library identities and asset paths.
3. Export/reimport a dedicated content copy and inspect the actual dependency list for Column
   1.21, AdvancedText 1.3, and required editor dependencies. Confirm there are no validation errors.
4. Retain JSON for existing Book 1.16 / Column 1.20 / AdvancedText 1.2 content before upgrading.
   Also include earlier Book/Column content and QuestionSet/ScaleQuestion examples where practical.
5. Install compatible libraries, then explicitly run the normal H5P content upgrade. Verify Book
   1.17, Column 1.21, AdvancedText 1.3, chapter order, titles, metadata, identifiers, child parameters,
   and unaffected sibling content. Existing content remains tied to its older libraries until
   upgraded; do not submit old Column content directly against new page semantics.

## Runtime and saved state

1. Visit every page and verify text, tooltips, images, nested Accordion, sidebar, page navigation,
   Summary, scoring, completion, and progress with existing question children.
2. Save/reload state from a later page with earlier pages uninitialized. Verify page selection,
   existing answers, scores, progress, and subsequently visited pages.
3. Use Reset Session before and after visiting all pages; confirm answers/state are cleared once
   per child, including deferred pages. Confirm a later reload does not restore stale state.
4. Check desktop and narrow viewports, keyboard focus, fullscreen, resize propagation, and console
   errors. Retain zero-chapter runtime characterization as a separate automated edge case.
