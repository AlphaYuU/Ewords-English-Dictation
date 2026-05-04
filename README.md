# Ewords Dictation

Desktop English dictation app for vocabulary libraries, dictionary lookup, local UK/US pronunciation, dictation practice, and history review.

## Stack

- Electron + React + TypeScript + Vite
- React Router
- Zustand
- SQLite through `node:sqlite`
- Piper TTS for local pronunciation
- Vitest and Playwright for verification

## Commands

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Data

- `data/raw` contains source dictionary, example, and official vocabulary files used by the seed scripts.
- `data/processed/dictation.sqlite` is the generated development database. It is larger than GitHub's normal file limit, so distribute it through a release asset, Git LFS, or regenerate it locally with `corepack pnpm db:seed`.
- `data/export/tatoeba_examples_and_attribution.csv` is used by the Settings page attribution export and should be included in packaged desktop releases.

## TTS

Run the setup command on Windows before testing pronunciation:

```bash
corepack pnpm tts:setup
```

The app uses Piper TTS with local UK/US voices.

## Verification

Before publishing or packaging, run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

For UI regressions, use the Playwright suites that match the change being tested.
