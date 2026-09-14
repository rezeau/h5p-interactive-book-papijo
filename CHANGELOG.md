# Changelog

## 1.15.0 - 2026-09-14

### Compatibility

- Updated Interactive Book pages from `H5P.ColumnPapiJo` 1.17 to 1.19.
- Added indirect compatibility with `H5P.QuestionSetPapiJo` 1.22.x through ColumnPapiJo 1.19.
- Confirmed that H5P's generic recursive content upgrade handles both nested dependency updates;
  no `upgrades.js` or direct QuestionSetPapiJo dependency is required.
- No child-library API changes are required.

### Fixed

- Prevented Summary from reading nested state and scores before pages are initialized, while
  retaining safe placeholders until live data is available.
- Made autosave safe after direct reload into a later page by querying only initialized pages and
  preserving existing saved child state for pages that remain uninitialized.
- Made Reset Session clear uninitialized pages without invoking attachment-dependent child APIs;
  deferred pages attach before receiving one normal reset, so stale answers and progress are not
  restored.

## 1.14.3 - 2026-09-01

### Changed

- Restored the red PapiJo-branded Interactive Book icon.

### Maintenance and characterization

- Added Node-based runtime characterization for construction, navigation, state, scoring, xAPI, completion, reset, and resize behavior.
- Added a manual browser checklist for layout, focus, fullscreen, state restoration, nested content, and resize propagation.
- Added release metadata, production immutability, dependency-closure, and allowlist-based package verification.

### Compatibility

- Retains the `H5P.InteractiveBookPapiJo` machine name, the 1.14 library line, the H5P Core API 1.28 requirement, and `H5P.ColumnPapiJo` 1.17 pages.
- No InteractiveBookPapiJo resize defect or runtime behavior change is claimed by this release; resize work in this cycle characterized the existing container behavior.
