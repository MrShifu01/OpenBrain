# Supabase Migrations

## Numbering convention

`NNN_description.sql` — three-digit zero-padded prefix, snake_case description.
The next free prefix at the time of writing is **064**. Pick the next integer
when adding a new migration.

## Tracking model — why duplicate prefixes are NOT a replay hazard

Supabase's `supabase_migrations.schema_migrations` table tracks each migration
by a 14-digit timestamp (`version`) plus `name`, **not** by the filename
prefix. Both `058_canonical_schedule_fields.sql` and
`058_user_profiles_onboarded_at.sql` are recorded with distinct timestamps:

```
20260428154141  058_canonical_schedule_fields
20260429102341  058_user_profiles_onboarded_at
```

So the duplicate `004_*` and `058_*` prefixes you'll see in this directory
are a cosmetic accident from parallel branches landing on the same prefix —
they replay correctly because the CLI orders by `version`, not by filename.

**However**, when applying via raw `supabase db push` against a new project,
the CLI reads file metadata (mtime / lexical order) to assign timestamps. To
keep that replay deterministic, do not insert new migrations between two
historical files; always append at the next free integer prefix.

## Known duplicate prefixes (historical)

| Prefix | Files |
|--------|-------|
| `004_` | `004_push_notifications.sql`, `004_user_memory.sql` |
| `058_` | `058_canonical_schedule_fields.sql`, `058_user_profiles_onboarded_at.sql` |

Both pairs are independent table additions. They were applied to production
without conflict because they touch disjoint tables. Leave them — renaming a
file rewrites its `version` in `schema_migrations` (or worse, replays it on a
fresh DB), which is more risky than the cosmetic flaw it solves.

## Local-dev fresh-DB rebuild

`supabase db reset` replays every file in this directory in lexical order.
Test against a fresh project before any migration that depends on prior
state.

## Applying via the Supabase MCP

The agentic path is `mcp__plugin_supabase_supabase__apply_migration`. It runs
the SQL against the live project AND records the migration in
`schema_migrations` so subsequent CLI runs don't try to re-apply. Used for
`063_perf_rls_and_io.sql`.
