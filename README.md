# H5P Interactive Book PapiJo

Interactive Book PapiJo is an H5P component that presents interactive content in pages and sections. It uses the `H5P.InteractiveBookPapiJo` machine name and `H5P.ColumnPapiJo` pages.

Current release: **1.15.0**

This release uses `H5P.ColumnPapiJo 1.19` pages, which provide indirect compatibility with
`H5P.QuestionSetPapiJo 1.22.x`. Interactive Book has no direct QuestionSetPapiJo dependency.

Version 1.15.0 improves partially initialized books: direct reloads into later pages no longer
cause premature Summary, score, or state reads, and Reset Session safely clears pages that have
not yet been attached. Valid saved state is retained during normal autosave and discarded when a
session is reset. No child-library API changes are required.

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
