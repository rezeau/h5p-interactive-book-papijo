# InteractiveBookPapiJo 1.17.0 candidate revalidation

Audit date: 2026-10-10. Result: ready for review. No further production correction required.

## Preflight and production delta

- Repository: `C:/Users/josep/OneDrive/Documents/CODEX/papi-jo-h5p-interactivebook`.
- Branch: `master`; initial HEAD and final HEAD: `00aa68decedf0b39edbecb60fc6729ad93391d10`.
- Local `origin/master`: `3077f06a537e800e259bb0fdd16b5c21997d761a`.
- Initial tree and index were clean. Initial/final relationship: 1 ahead, 0 behind.
  This is the local remote-tracking state; no fetch/push was performed.
- Published baseline: `v1.16.0`, library 1.16.0, Column preload/page option 1.20.
- Existing candidate production delta: library minor 16 -> 17, preloaded Column minor
  20 -> 21, and chapter library option `H5P.ColumnPapiJo 1.20` -> `1.21`.
- Candidate library/package versions remain 1.17.0. No production files were changed
  during this revalidation. No direct Accordion/Text dependencies or `upgrades.js` added.
- Complete candidate diff relative to origin/master was inspected: 14 files,
  511 insertions and 54 deletions, including existing tests/docs/release checks.

## Actual read-only dependency candidates

| Source repository | Actual version | Git HEAD | Initial/final Git state |
| --- | --- | --- | --- |
| `../papi-jo-h5p-column` | ColumnPapiJo 1.21.0 | `dd1f5596063127e493494102606d97f0065ef1bf` | master, clean, 2 ahead / 0 behind |
| `../papi-jo-h5p-accordion` | Public AccordionPapiJo 1.2.0 | `ae5e9266d93b8bb18fd3eb419bcf3fdcf9e9bb46` | master, existing candidate edits, 0 ahead / 0 behind |
| `../papi-jo-h5p-advancedtext` | AdvancedTextPapiJo 1.3.0; editor 1.2.0 in `editor/` | `20cfd5a9482063aca2139663d48b60b89487fc01` | master, existing candidate edits, 8 ahead / 0 behind |

Accordion's working candidate differs from HEAD in README, library, semantics and
characterization test, with three existing untracked upgrade/probe helpers. AdvancedText's
working candidate has nine existing modified files and three untracked release-candidate files.
The tested sources are those actual working candidates, not their older HEAD manifests.

SHA-256 identifies the exact consumed working-tree metadata:

| Source file | SHA-256 |
| --- | --- |
| Column `library.json` | `cc68c1b3ac6c8880a890fa1f8ddba379589d14a36150ed0e2a986ae1859cf455` |
| Column `semantics.json` | `1e51d75227764c150b2972690e43409c5cae594aeb2a619da9b20897cdb0931a` |
| Accordion `library.json` | `96de4a02ae9c4fbe1bb46723828ef8078621ebb80ba77b81bcdc3a0f2eb6aa5c` |
| Accordion `semantics.json` | `039554cd7bee293637f69bdcbf133d96e6d92c5bbaeab08451a4910e2ea1c60a` |
| AdvancedText `library.json` | `651b25851dc7a5cfab8fca070564f3b8f324e9d1ac5b5eff43993ddb62977116` |
| AdvancedText `semantics.json` | `ec0b89c8cfbc7a792c29068f110320eecb471fb16e678df25b63586eb50cd723` |
| Tooltip editor `library.json` | `2803810866bad779cd58ab2f42ba4cb92e163b06dd90533b126ab189fa9e8da9` |

The manifests/semantics establish:

```text
InteractiveBookPapiJo 1.17 -> ColumnPapiJo 1.21
                               -> AdvancedTextPapiJo 1.3 -> tooltip editor 1.2
                               -> AccordionPapiJo 1.2
                                    -> AdvancedTextPapiJo 1.3 -> tooltip editor 1.2
```

Before/after SHA-256 fingerprints matched for all 74 Column, 16 Accordion and 90
AdvancedText tracked/non-ignored untracked files, with unchanged HEADs and Git/index status.
No dependency repository was modified by this audit.

## Installed WordPress/H5P selection evidence

Read-only sources: `C:/wamp64/www/wp-h5p/wp-content/plugins/h5p`.

- `admin/class-h5p-library-admin.php:395`: `display_content_upgrades` obtains same-name
  library rows, calls core `getUpgrades` at line 414 and exposes the result as `versions`
  at line 456. The site also requires installed versions and old main-library content.
- `h5p-php-library/h5p.classes.php:2845`: actual `getUpgrades` offers higher major/minor
  versions, not patch-only changes. With real source/target manifests represented as
  storage rows, Book 1.16.0 -> 1.17.0 is offered; 1.16.0 -> 1.16.99 is excluded.
- Installed `js/h5p-content-upgrade.js`: the actual ready/click handler selects 1.17.0,
  submits its library ID, batches the old main-library parameters and invokes the
  installed `ContentUpgradeProcess`. Tests capture the outgoing completed batch and
  assert no skipped content. DOM/transport are in-memory adapters; no network is used.
- `admin/class-h5p-library-admin.php:563` reads selected `libraryId`; line 588 writes
  `$to_library->id` when saving an actual site upgrade. This code was inspected only.
- `h5p.classes.php:4774`: installed `validateLibrary` recursively filters authored
  values and invokes real `findLibraryDependencies`; tests use these unchanged methods
  with actual candidate registrations and read-only storage for unrelated utilities.

This proves eligibility when these libraries are installed and old main-library content
exists, plus actual UI-to-engine reachability. It does not claim candidates were installed
in WordPress or that live InteractiveBook editor/runtime/save acceptance was performed.
WordPress was not bootstrapped and no database, AJAX endpoint or site file write was used.

## Upgrade, preservation and dependency results

- **A:** Book 1.14 / Column 1.17, Book 1.15 / Column 1.19, and Book 1.16 / Column 1.20
  reach Book 1.17 / Column 1.21 / actual direct Text 1.3, with managed stores present
  and absent. Historical 1.14 storage manifest comes from the real `v1.14.3` tag.
- **B:** Book 1.16 -> Column 1.21 -> public Accordion 1.2 -> Text 1.3 passes with
  two ordered panels and present/absent managed image stores.
- **C:** One three-chapter mixed book upgrades direct and nested legacy children,
  preserves current valid children and unaffected `H5P.AdvancedText 1.1` siblings.
- **D:** Current Accordion/Text inside old Column remain unchanged; current Column
  with structurally current descendants also survives without child library loading.
  The core skips recursion through same-version container references, so a current
  container containing invalid old children is not represented as a valid fixture.
- Complete before/after equality allows only intended library-reference updates.
  Normal PHP validation also preserves valid fixture content exactly: chapter/child/panel
  order, book/Column/Accordion settings, rich text, tooltip data/images, inline-image
  stores and occurrence IDs, captions, links, widths/left wrapping, metadata, UUIDs and
  file paths. Optional inline/tooltip stores, metadata, cover and retry fields remain
  absent where initially absent.
- Unsafe HTML and unknown fields are removed by normal filtering while both migrated
  chains remain present, with image definitions/occurrences and file paths retained.
- Old Book page semantics reject target Column pages, demonstrating why normal content
  upgrade must precede validation/saving against 1.17 semantics.
- The mixed book rebuilds **16 dependency entries**, including final Book 1.17, Column
  1.21, Accordion 1.2, Text 1.3 and tooltip editor 1.2 plus the real utility/editor/sibling
  closure. No old PapiJo chain versions remain; dependency weights are positive.

## Focused regression and release preparation changes

Removed prospective 1.3 registration from 1.2.6 sources. Candidate loading fails rather
than skipping or falling back. The release guard rejects old Book/Column/Text/editor
targets, a dirty/unrepaired Column, broken Accordion 1.1.7/private recovery 1.1.8,
missing sources and a same-version packaging Column with unrepaired semantics.

`verify:release` now includes the actual-chain check. The package builder runs production,
metadata and chain/source preflights before building/creating output; its chosen Column
manifest, semantics and declared runtime files must match the repaired candidate bytes.
It still follows manifest dependencies; semantics-only child libraries are installed
separately. The builder was not invoked during this audit.

Files changed, all unstaged/uncommitted:

1. `CHANGELOG.md`
2. `README.md`
3. `package.json` (verification script only; version unchanged)
4. `tests/README.md`
5. `tests/browser/interactivebook-1.17-column-1.21.md`
6. `tests/runtime/column-1.21-compatibility.test.cjs`
7. `tests/runtime/helpers/column-1.21-validator.php`
8. `tools/build-release-package.ps1`
9. `tools/verify-release-metadata.cjs`
10. `tests/runtime/helpers/interactivebook-candidate.cjs` (new)
11. `tools/verify-release-chain.cjs` (new)
12. `tests/REVALIDATION-1.17.0.md` (new, this report)

## Complete final verification

- `npm run verify`: **71 tests passed, 0 failed, 0 skipped, 0 cancelled, 0 todo**.
  Includes **32 final-chain tests** and **39 retained established tests**.
- Production immutability: **27 tracked files byte-identical to v1.16.0**, **7 compiled
  assets** match reviewed hashes; only the three existing metadata changes are allowed.
- Release metadata and actual-candidate chain checks: passed.
- JSON parse validation: **9 files** passed, including hidden language/config files.
- JavaScript syntax: **25 files** passed, including production modules and compiled JS.
- PHP syntax: **1 helper** passed. PowerShell syntax: **3 scripts/modules** passed.
- `git diff --check`: passed; index is empty; production diff against candidate HEAD is empty.
- Separate `npm run lint:js` diagnostic: **2 pre-existing errors, 0 warnings**:
  `src/entries/main.js:6` (`no-global-assign`) and `src/scripts/urltools.js:56`
  (`no-prototype-builtins`). Both files are verified byte-identical to v1.16.0 and the
  candidate HEAD; no production change was justified for this audit.
- Final Git state: `master`, original candidate HEAD, 1 ahead / 0 behind; **9 modified
  tracked files and 3 new files**, all unstaged. No commit/amend/history rewrite.
- Other candidate repositories unchanged; WordPress/database unmodified.
- No release package, tag, push or publication. The retained archive regression creates
  and removes tiny synthetic CSS ZIP fixtures only; it does not package candidate libraries.

READY FOR INTERACTIVEBOOK 1.17.0 REVIEW
