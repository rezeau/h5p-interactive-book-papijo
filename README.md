# H5P Interactive Book PapiJo

Interactive Book PapiJo is an H5P component that presents interactive content in pages and sections. It uses the `H5P.InteractiveBookPapiJo` machine name and `H5P.ColumnPapiJo` pages.

Current release: **1.16.0**

This release uses `H5P.ColumnPapiJo 1.20` pages, providing transitive compatibility with
`H5P.QuestionSetPapiJo 1.23` and `H5P.ScaleQuestion 0.2`. Interactive Book has no direct
QuestionSetPapiJo or ScaleQuestion dependency.

Version 1.16.0 is a compatibility-only release; Interactive Book runtime behavior is unchanged.
Real-H5P-core regression tests cover recursive upgrades from Interactive Book 1.15 through Column
1.20 and QuestionSet 1.23 to direct and nested ScaleQuestion 0.2 content, while preserving chapter
and child data. QuestionSetPapiJo and ScaleQuestion are semantics-level child types and must be
installed separately when they are not already available; the library-only release package does
not add them as direct Interactive Book dependencies.

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
