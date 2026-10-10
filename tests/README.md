# Interactive Book PapiJo characterization tests

These tests cover the observable contracts and page-lifecycle regressions of
`H5P.InteractiveBookPapiJo` 1.17.0.

Run the runtime and required local integration suite with:

```powershell
node --test tests/runtime/*.test.cjs
```

The runtime harness executes the current production source unchanged. It stubs only imported collaborators, H5P core services, and browser DOM primitives.

The browser checklists in `tests/browser/` cover behaviors that cannot be established reliably
with the lightweight Node harness: rendered layout, focus, fullscreen, clipping, actual
iframe/core propagation, timing-sensitive resize behavior, passive autosave, and Reset Session
across partially initialized pages.

Use `tests/browser/interactivebook-1.17-column-1.21.md` for the current compatibility candidate.
The other versioned browser documents are retained as historical verification records.

`column-1.21-compatibility.test.cjs` requires the actual final candidates: clean Column 1.21.0 at
`dd1f5596063127e493494102606d97f0065ef1bf`, public Accordion 1.2.0, AdvancedText 1.3.0 and tooltip
editor 1.2.0. It executes the installed `getUpgrades` selection, upgrade UI click/batch path and
recursive engine with in-memory transport, then the installed PHP validator/dependency traversal.
Cases cover direct/nested chains, a mixed three-chapter book, current valid descendants, normal
filtering, preserved data/optional absence and old-semantics rejection. Negative gates reject
old targets, broken/private Accordion versions, an unrepaired/dirty Column and missing sources.
No target candidate is version-rewritten, fabricated, loaded from a tag, or silently skipped.

Default sources are the sibling Column, Accordion and AdvancedText repositories (editor in `editor/`)
and `C:/wamp64/www/wp-h5p/wp-content/plugins/h5p/h5p-php-library`. Overrides:
`H5P_COLUMN_PAPIJO_121_PATH`, `H5P_ACCORDION_PAPIJO_12_PATH`, `H5P_ADVANCEDTEXT_PAPIJO_13_PATH`,
`H5P_ADVANCEDTEXT_PAPIJO_EDITOR_12_PATH`, `H5P_PLUGIN_ROOT`, `H5P_CORE_PHP_PATH`, `H5P_CORE_JS_PATH`,
`H5P_PHP_BINARY`, and `H5P_LIBRARY_ROOT`. An explicit missing/wrong source fails without fallback.
`H5P_LIBRARY_ROOT` supplies unrelated utility/sibling libraries only, never the candidate chain.
The PHP helper supplies storage and registers actual manifests/semantics verbatim; validation, semantics loading,
and dependency traversal use the original installed H5P classes. Historical 1.16 upgrade coverage
loads that version's manifest and semantics from the `v1.16.0` Git tag. When current sibling
checkouts have moved on, it loads actual Column 1.20.0 and ScaleQuestion 0.2.1 sources from
their release tags into temporary snapshots, retaining the original version assertions.

`npm run verify` enforces production immutability, metadata, the actual release chain and all tests.
Package source preflight is tested without creating an H5P release. The established archive regression
creates and removes tiny synthetic ZIP fixtures only. See [revalidation results](REVALIDATION-1.17.0.md).
