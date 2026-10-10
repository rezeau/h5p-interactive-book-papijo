# Interactive Book PapiJo characterization tests

These tests cover the observable contracts and page-lifecycle regressions of
`H5P.InteractiveBookPapiJo` 1.17.0.

Run the dependency-free runtime suite with:

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

`column-1.21-compatibility.test.cjs` uses the prepared sibling Column 1.21 checkout, the installed
PHP H5P validator/core, and the real JavaScript content-upgrade process. It covers page acceptance,
normal filtering, preloaded dependency traversal, old-semantics rejection, and upgrades from Book
1.14/1.15/1.16. Prospective nested coverage registers unchanged AdvancedText 1.2.6 sources as 1.3
only in memory; it does not establish behavior of an actual AdvancedText 1.3 release.

Default sources are the sibling `papi-jo-h5p-column` and `papi-jo-h5p-advancedtext` repositories
and `C:/wamp64/www/wp-h5p/wp-content/plugins/h5p/h5p-php-library`. Overrides:
`H5P_COLUMN_PAPIJO_121_PATH`, `H5P_ADVANCEDTEXT_PAPIJO_126_PATH`, `H5P_CORE_PHP_PATH`,
`H5P_CORE_JS_PATH`, `H5P_PHP_BINARY`, and `H5P_LIBRARY_ROOT`. Missing integration sources produce
explicit skips or a prospective-coverage notice. Library discovery requires exact manifest versions.
The PHP helper supplies only storage and in-memory registration; validation, semantics loading,
and dependency traversal use the original installed H5P classes. Historical 1.16 upgrade coverage
loads that version's manifest and semantics from the `v1.16.0` Git tag. When current sibling
checkouts have moved on, it loads actual Column 1.20.0 and ScaleQuestion 0.2.1 sources from
their release tags into temporary snapshots, retaining the original version assertions.
