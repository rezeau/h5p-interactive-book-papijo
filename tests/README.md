# Interactive Book PapiJo characterization tests

These tests freeze observable contracts of `H5P.InteractiveBookPapiJo` 1.14.2 without changing production code.

Run the dependency-free runtime suite with:

```powershell
node --test tests/runtime/*.test.cjs
```

The runtime harness executes the current production source unchanged. It stubs only imported collaborators, H5P core services, and browser DOM primitives.

The browser checklist in `tests/browser/manual-checklist.md` covers behaviors that cannot be established reliably with the lightweight Node harness: rendered layout, focus, fullscreen, clipping, actual iframe/core propagation, and timing-sensitive resize behavior.
