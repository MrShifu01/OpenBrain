# Next Steps — 2026-04-02

## Immediate (do first)
1. Verify live deployment at open-brain-sigma.vercel.app — confirm entries load, edit/delete work, photo upload works
2. If type classification still wrong after deploy: tighten prompt at src/OpenBrain.jsx line ~109 (handleSave in QuickCapture)

## Soon (this milestone)
- Add metadata editing to the edit form in DetailModal (src/OpenBrain.jsx, DetailModal component ~line 667) — currently only title/type/content/tags are editable
- Consider pagination or virtual scroll if entry count grows beyond 200 (api/entries.js currently fetches limit=500)
- TodoView: wire todos to actual reminder-type entries from DB rather than localStorage-only

## Deferred
- Graph view still references INITIAL_ENTRIES directly (~line 712 GraphView) — should use live entries prop
- Calendar view likewise — update both to receive entries as prop

## Warnings
- ⚠️ INITIAL_ENTRIES hardcoded at top of src/OpenBrain.jsx are stale placeholder data. Once DB is populated, remove them and let localStorage/DB be the only source.
- ⚠️ api/entries.js fetches up to 500 entries unfiltered — add user_id filter once multi-user support is needed
