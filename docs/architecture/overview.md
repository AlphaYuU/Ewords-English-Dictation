# Architecture Overview

The desktop runtime follows this layered structure:

```text
Renderer page -> Zustand store / desktop bridge -> Electron IPC adapter -> data-access application service -> SQLite
```

The React renderer owns routes, dialogs, and interaction state. Electron owns OS integration and IPC. Database behavior is implemented in `packages/data-access`, while the Electron database IPC file is only an adapter that resolves app paths and forwards existing `DatabaseQuery` requests.

## Packages

- `packages/ui`: token-aligned reusable desktop components.
- `packages/design-tokens`: copied `design-tokens.json` exported as typed tokens.
- `packages/domain`: models, validation rules, summaries, defaults.
- `packages/data-access`: SQLite client, schema mapping, repositories, and the application database service used by Electron.
- `packages/dictation-engine`: grading and dictation state machine.
- `packages/dictionary-engine`: English / Chinese / fuzzy dictionary search.
- `packages/import-export`: CSV/TXT parsing and CSV export helpers.
- `packages/audio`: Piper-backed desktop bridge audio abstraction for controlled UK / US pronunciation.

## Desktop App

`apps/desktop` contains Electron shell files and the Vite React renderer. The renderer implements the desktop routes, dialog entry points, IPC bridge, and local data hydration flow used by the packaged app.

Electron main process code is bundled during `corepack pnpm build`, so workspace package code needed by the main process is included in `apps/desktop/dist-electron/main/main.js`. Runtime resources such as the seeded SQLite database, Piper assets, and third-party notices are still provided through packaging `extraResources`.
