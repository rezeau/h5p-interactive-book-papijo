# H5P Interactive Book PapiJo

Interactive Book PapiJo is an H5P component that presents interactive content in pages and sections. It uses the `H5P.InteractiveBookPapiJo` machine name and `H5P.ColumnPapiJo` pages.

Current release: **1.17.0**

This compatibility candidate uses `H5P.ColumnPapiJo 1.21` pages, preparing the dependency chain
for `H5P.AdvancedTextPapiJo 1.3` while retaining transitive compatibility with
`H5P.QuestionSetPapiJo 1.23` and `H5P.ScaleQuestion 0.2`. Interactive Book has no direct
AdvancedTextPapiJo, QuestionSetPapiJo, or ScaleQuestion dependency.

Version 1.17.0 changes compatibility metadata only; runtime source and compiled assets are unchanged.
Real H5P core tests cover recursive upgrades from Interactive Book 1.14, 1.15, and 1.16 to Column
1.21 while preserving chapter and child data. Historical regression coverage also retains the
1.15 -> 1.16 recursive QuestionSet/ScaleQuestion upgrade. No Interactive Book `upgrades.js` is
required: install compatible libraries, then run H5P's normal content upgrade before saving older
content against the new semantics. Installing libraries alone does not upgrade existing content.

The installed PHP validator verifies Column 1.21 page acceptance, semantic filtering, dependency
traversal, and rejection under the old Column 1.20 page semantics. A prospective nested test
registers unchanged AdvancedTextPapiJo 1.2.6 sources as 1.3 only in memory; this is not an actual
AdvancedText 1.3 candidate or packaged release. Validate the complete chain in the editor and
runtime once the real candidate exists. AdvancedTextPapiJo, QuestionSetPapiJo, and ScaleQuestion
must be installed separately where used. See the
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
