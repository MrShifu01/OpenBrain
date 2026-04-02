# OpenBrain — Session Learnings

---

### 2026-04-02 — Silent error swallowing causes phantom saves
- **What happened:** Edit modal appeared to save successfully (optimistic state update) but data vanished on refresh because the PATCH to Supabase was failing silently — `try { await fetch(...) } catch {}` + unconditional state update.
- **Learned:** Never update local state unconditionally after a mutating fetch. Always check `res.ok` and only update state on confirmed success. Also check for empty-array response (0 rows matched) when Supabase returns `Prefer: return=representation`.
- **Action:** Pattern: `const res = await fetch(...); const data = await res.json(); if (!res.ok) throw ...; if (Array.isArray(data) && data.length === 0) throw ...; // then update state`

### 2026-04-02 — Check actual DB schema before implementing features
- **What happened:** `tags` field was wired end-to-end (AI parses it, API sends it, frontend uses it) but the Supabase `entries` table had no `tags` column. PATCH failed with "could not find the 'tags' column" — only visible after adding error surfacing.
- **Learned:** Before building a feature that writes a field to the DB, verify the column exists via `list_tables` or `execute_sql`. Don't assume the schema matches the app's data model.
- **Action:** On any new field: `mcp__claude_ai_Supabase__list_tables` first. Then code. Columns don't auto-create.

### 2026-04-02 — PostgreSQL generated columns require IMMUTABLE functions
- **What happened:** Tried to add `array_to_string(tags, ' ')` to a `GENERATED ALWAYS AS` tsvector column. Migration failed: "generation expression is not immutable". `array_to_string` is STABLE, not IMMUTABLE.
- **Learned:** PostgreSQL generated columns only accept IMMUTABLE functions. `array_to_string`, `now()`, and subqueries are disqualified. Use a trigger (`BEFORE INSERT OR UPDATE`) for derived columns that need STABLE or VOLATILE functions.
- **Action:** Any generated column including arrays → use trigger pattern instead. Template: `CREATE FUNCTION f() RETURNS trigger AS $$ BEGIN new.col := ...; return new; END; $$ LANGUAGE plpgsql; CREATE TRIGGER t BEFORE INSERT OR UPDATE ON tbl FOR EACH ROW EXECUTE FUNCTION f();`

### 2026-04-02 — Supabase RPC functions can silently ignore auth context
- **What happened:** The `capture()` RPC had `v_owner_id := '00000000-0000-0000-0000-000000000001'` hardcoded. The API passed `p_user_id: user.id` correctly but the function ignored it entirely. Safe for single-user but a latent auth bypass.
- **Learned:** Always read the full RPC function body before assuming it uses the authenticated user. `SECURITY DEFINER` functions don't inherit the caller's auth context — they must explicitly use a passed-in user ID or `auth.uid()`.
- **Action:** After any `apply_migration` that creates/updates an RPC: run `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'fname'` to verify the function body does what you expect.

### 2026-04-02 — datalist for type-ahead with free-text fallback
- **What happened:** User wanted to add custom types not in the dropdown. `<select>` forces a fixed choice list.
- **Learned:** `<input list="id"> + <datalist>` gives dropdown suggestions AND allows arbitrary free-text input. The correct pattern for "suggest but don't restrict".
- **Action:** Use `<select>` only when the value must be one of a strict set. Use `<input list>` + `<datalist>` when custom values should be accepted. Also: relax API validation from allowlist to length/type check to match.
