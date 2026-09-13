# Changelog

## 1.15.0 - 2026-09-13

### Compatibility

- Updated Interactive Book chapters from `H5P.ColumnPapiJo` 1.17 to 1.19.
- Added indirect support for `H5P.QuestionSetPapiJo` 1.22 through ColumnPapiJo 1.19.
- Confirmed that H5P's generic recursive content upgrade handles both nested dependency updates;
  no `upgrades.js` or direct QuestionSetPapiJo dependency is required.
- No runtime behavior was intentionally changed.

## 1.14.3 - 2026-09-01

### Changed

- Restored the red PapiJo-branded Interactive Book icon.

### Maintenance and characterization

- Added Node-based runtime characterization for construction, navigation, state, scoring, xAPI, completion, reset, and resize behavior.
- Added a manual browser checklist for layout, focus, fullscreen, state restoration, nested content, and resize propagation.
- Added release metadata, production immutability, dependency-closure, and allowlist-based package verification.

### Compatibility

- Retains the `H5P.InteractiveBookPapiJo` machine name, the 1.14 library line, the H5P Core API 1.28 requirement, and `H5P.ColumnPapiJo` 1.17 chapters.
- No InteractiveBookPapiJo resize defect or runtime behavior change is claimed by this release; resize work in this cycle characterized the existing container behavior.
