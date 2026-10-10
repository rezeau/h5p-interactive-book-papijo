# H5P Interactive Book PapiJo

Interactive Book PapiJo is an H5P component that presents interactive content in pages and sections. It uses the `H5P.InteractiveBookPapiJo` machine name and `H5P.ColumnPapiJo` pages.

Current release: **1.17.0** (unreleased candidate)

This compatibility candidate uses the final repaired `H5P.ColumnPapiJo 1.21.0` pages, which target
`H5P.AdvancedTextPapiJo 1.3` and public `H5P.AccordionPapiJo 1.2`. Accordion also targets
AdvancedText 1.3, whose tooltip editor dependency is `H5PEditor.AdvancedTextPapiJoTooltip 1.2`.
It retains transitive compatibility with
`H5P.QuestionSetPapiJo 1.23` and `H5P.ScaleQuestion 0.2`. Interactive Book has no direct
AccordionPapiJo, AdvancedTextPapiJo, QuestionSetPapiJo, or ScaleQuestion dependency.

Version 1.17.0 changes compatibility metadata only; runtime source and compiled assets are unchanged.
Installed H5P tests cover main-library upgrade selection and recursive upgrades from Interactive
Book 1.14, 1.15, and 1.16 to Column 1.21 using the actual candidate repositories. Direct Text,
nested Accordion/Text, mixed books, and structurally current children preserve authored data.
Historical regression coverage also retains the
1.15 -> 1.16 recursive QuestionSet/ScaleQuestion upgrade. No Interactive Book `upgrades.js` is
required: install compatible libraries, then run H5P's normal content upgrade before saving older
content against the new semantics. Installing libraries alone does not upgrade existing content.

The installed PHP validator verifies the complete recursive chain after normal filtering and
rebuilds the final runtime/editor dependencies. The installed WordPress upgrade UI is executed
with in-memory transport; no site/database changes or live InteractiveBook editor/save acceptance
are claimed by these tests. The 1.16 -> 1.17 minor boundary is eligible under `H5PCore::getUpgrades`;
a patch-only release would not be. Already-current containers must already have valid current
descendants: H5P skips recursion through an unchanged library reference.
AccordionPapiJo, AdvancedTextPapiJo and its tooltip editor, QuestionSetPapiJo, and ScaleQuestion
must be installed separately where used. See the [revalidation report](tests/REVALIDATION-1.17.0.md) and
[1.17 integration checklist](tests/browser/interactivebook-1.17-column-1.21.md).

## Getting started

Grab all the modules:

```bash
npm install
```

Build project:

```bash
npm run build
```

Run the aggregate release verification checks:

```bash
npm run verify
```

Run lint separately as a diagnostic check:

```bash
npm run lint:js
```

Build an allowlist-based H5P release package with the required libraries from the local H5P development environment:

```powershell
npm run package:release -- -OutputDirectory <output-directory>
```

The release package is a libraries-only archive intended for installation through the H5P library administration page.
Its preflight requires the actual final candidates and checks the selected Column payload against
the clean repaired commit `dd1f5596063127e493494102606d97f0065ef1bf`. It follows manifest dependencies;
semantics-only child types must be installed separately. Release packaging has not been run for
this candidate revalidation.
