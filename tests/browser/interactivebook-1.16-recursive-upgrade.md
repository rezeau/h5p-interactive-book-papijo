# InteractiveBookPapiJo 1.16 recursive-upgrade browser checklist

Use a dedicated copy of the existing `ib-pj-001` fixture. Record the H5P core, browser, viewport,
content identity, and installed library versions before starting.

## Required library chain

- `H5P.InteractiveBookPapiJo 1.16.0`
- `H5P.ColumnPapiJo 1.20.0`
- `H5P.QuestionSetPapiJo 1.23.0`
- `H5P.ScaleQuestion 0.2.1`

Install semantics-level child libraries separately when they are not already present. Installing
the new libraries and upgrading existing content are separate operations.

## Existing-content upgrade

1. Before upgrading, retain the dedicated fixture's content JSON and note chapter order, titles,
   metadata, and subcontent identifiers.
2. Confirm the source contains ColumnPapiJo 1.19, a direct ScaleQuestion 0.1, QuestionSetPapiJo
   1.22 containing ScaleQuestion 0.1, and unaffected AdvancedTextPapiJo and TrueFalse siblings.
3. Run the normal H5P content upgrade for the dedicated Interactive Book.
4. Confirm the resulting references are ColumnPapiJo 1.20, QuestionSetPapiJo 1.23, and
   ScaleQuestion 0.2 for both direct and nested ScaleQuestion content.
5. Confirm chapter order, titles, metadata, subcontent identifiers, child parameters, and
   unaffected siblings match the retained source content.

## Runtime verification

1. Open every chapter and use both direct and QuestionSet-nested ScaleQuestion instances.
2. Confirm scoring, completion, progress indicators, Summary, retry, and Reset Session behavior.
3. Save or allow state to persist, reload the same session, and confirm the selected chapter,
   answers, progress, and scores restore correctly.
4. Navigate repeatedly between differently sized chapters at desktop and narrow widths.
5. Confirm there are no missing-library, state-read, reset, resize, or console errors.

This browser check verifies saved-state and rendered runtime behavior separately from the
`ContentUpgradeProcess` regression test, which covers content parameters and metadata only.
