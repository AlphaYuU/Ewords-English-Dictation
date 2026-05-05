# Architecture Overview

The app follows the requested layered structure:

```text
Page -> Store/Hook -> Service -> Repository -> SQLite
```

Current implementation includes a working React desktop UI backed by Zustand state for interactive workflows, plus SQLite repository and seed layers for local persistence initialization.

## Packages

- `packages/ui`: token-aligned reusable desktop components.
- `packages/design-tokens`: copied `design-tokens.json` exported as typed tokens.
- `packages/domain`: models, validation rules, summaries, defaults.
- `packages/data-access`: SQLite client, schema mapping, repositories.
- `packages/dictation-engine`: grading and dictation state machine.
- `packages/dictionary-engine`: English / Chinese / fuzzy dictionary search.
- `packages/import-export`: CSV/TXT parsing and CSV export helpers.
- `packages/audio`: Piper-backed desktop bridge audio abstraction for controlled UK / US pronunciation.

## Desktop App

`apps/desktop` contains Electron shell files and the Vite React renderer. The renderer implements the desktop routes, dialog entry points, IPC bridge, and local data hydration flow used by the packaged app.
