# Changelog

## 1.17.0 - 2026-10-10

### Compatibility

- Updated page semantics and the preloaded `H5P.ColumnPapiJo` dependency from 1.20 to 1.21
  to prepare transitive compatibility with the future `H5P.AdvancedTextPapiJo` 1.3 release.
- Verified actual Column 1.21 acceptance and dependency traversal using the installed H5P PHP
  validator/core, with semantic and HTML filtering intact and old page semantics rejecting 1.21.
- Verified the prospective Interactive Book -> Column 1.21 -> AdvancedText 1.3 chain using only
  an in-memory 1.3 registration of unchanged AdvancedText 1.2.6 sources. Actual 1.3 integration
  remains pending that candidate; no child release was fabricated or packaged.
- Added real H5P core upgrade coverage from Interactive Book 1.14, 1.15, and 1.16 to Column 1.21,
  preserving chapter order, metadata, identifiers, parameters, and unaffected children.

### Changed

- Compatibility metadata only; runtime source and compiled assets are unchanged from 1.16.0.
  H5P's normal recursive content upgrade handles the dependency change without an Interactive
  Book `upgrades.js`. Install compatible child libraries separately before upgrading content.

## 1.16.0 - 2026-09-24

### Compatibility

- Updated Interactive Book pages from `H5P.ColumnPapiJo` 1.19 to 1.20.
- Added transitive compatibility with `H5P.QuestionSetPapiJo` 1.23 and `H5P.ScaleQuestion` 0.2.
- Confirmed with the real H5P content-upgrade process that direct and nested content upgrades
  recursively from Interactive Book 1.15 through Column and QuestionSet to ScaleQuestion 0.2.
- Preserved chapter order, metadata, subcontent identifiers, child parameters, and unaffected
  sibling libraries in recursive-upgrade regression coverage.
- Kept QuestionSetPapiJo and ScaleQuestion as transitive, semantics-level child types; install
  those libraries separately when they are not included in the target H5P environment.

### Changed

- Updated compatibility metadata only. Interactive Book runtime behavior and runtime assets are
  unchanged from 1.15.0, and no Interactive Book `upgrades.js` is required.

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
