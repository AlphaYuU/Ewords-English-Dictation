# Database Schema

The SQLite migration is `data/migrations/0001_init.sql`.

Implemented tables:

- `dictionary_entries`
- `dictionary_examples`
- `vocabulary_libraries`
- `vocabulary_units`
- `vocabulary_words`
- `vocabulary_word_units`
- `dictation_sessions`
- `dictation_results`
- `user_word_state`
- `wrong_book_entries`
- `favorite_entries`
- `app_settings`
- `search_history`
- `import_tasks`
- `import_preview_rows`

Compatibility tables still present in the migration:

- `wrong_book_words`
- `favorite_words`

Current runtime reads and writes the word-level user state through `user_word_state`, `wrong_book_entries`, and `favorite_entries`. The compatibility tables are kept so older databases can migrate without data loss.

Run:

```bash
corepack pnpm db:migrate
corepack pnpm db:seed
```

The seed script reads from `data/raw`, not `codex/`.
