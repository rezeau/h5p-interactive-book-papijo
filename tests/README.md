# Interactive Book PapiJo characterization tests

These tests cover the observable contracts and page-lifecycle regressions of
`H5P.InteractiveBookPapiJo` 1.15.0.

Run the dependency-free runtime suite with:

```powershell
node --test tests/runtime/*.test.cjs
```

The runtime harness executes the current production source unchanged. It stubs only imported collaborators, H5P core services, and browser DOM primitives.

The browser checklists in `tests/browser/` cover behaviors that cannot be established reliably
with the lightweight Node harness: rendered layout, focus, fullscreen, clipping, actual
iframe/core propagation, timing-sensitive resize behavior, passive autosave, and Reset Session
across partially initialized pages.
