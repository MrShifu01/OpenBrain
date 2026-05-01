# Cmd+K capture — global capture shortcut

**Goal:** from any view, pressing Cmd+K (or Ctrl+K on Windows/Linux) opens the CaptureSheet with focus already in the textarea. Sub-100ms perceived latency. Power users live in this flow.

Day 14 ship target. Total budget: half a dev day.

---

## Current state

`OmniSearch` already listens for Cmd+K and opens itself. We need to:

1. Move the listener to a generic `useKeyboardShortcuts` hook that owns Cmd+K, Cmd+/, Esc.
2. Rebind:
   - **Cmd+K** → opens **CaptureSheet** (most-frequent action)
   - **Shift+Cmd+K** → opens **OmniSearch** (search is the second-most-frequent)
   - **Esc** → closes whichever is open (already mostly wired via Radix dialogs)

Why the rebinding: capture is the action, search is the lookup. The product is "second brain that captures" — the no-modifier shortcut should match the primary verb.

---

## Implementation

New file: `src/hooks/useKeyboardShortcuts.ts`. Single source of truth for global key handling.

```ts
// Sketch — actual signatures during exec
interface ShortcutHandlers {
  onCapture?: () => void;   // Cmd+K
  onSearch?: () => void;    // Shift+Cmd+K
  onEscape?: () => void;    // Esc (optional — Radix usually handles)
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Skip when user is typing in an input/textarea — this would make
      // Cmd+K inside the capture sheet open another capture sheet.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        // Exception: still allow Cmd+K from inside the capture textarea to
        // submit, since users expect modifier shortcuts to override focus
        // context in muscle memory. Actually NO — the existing capture
        // submit binding is Cmd+Enter. Don't double-bind. Just skip.
        if (e.key.toLowerCase() === "k") return;
      }

      if (e.key.toLowerCase() === "k") {
        if (e.shiftKey) {
          e.preventDefault();
          handlers.onSearch?.();
        } else {
          e.preventDefault();
          handlers.onCapture?.();
        }
        return;
      }

      if (e.key === "Escape") {
        handlers.onEscape?.();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.onCapture, handlers.onSearch, handlers.onEscape]);
}
```

Wire it from `Everion.tsx`:

```tsx
useKeyboardShortcuts({
  onCapture: () => appShell.openCapture(),
  onSearch: () => appShell.setShowOmniSearch(true), // or whatever the existing toggle is
});
```

Remove the legacy listener from `OmniSearch` to avoid double-fires.

---

## UX details

- **Pre-warm:** the dynamic import of `CaptureSheet` is already pre-warmed on mount (per the optimistic-capture work). So the first Cmd+K should already be ≤100ms; verify with a Performance trace once the binding is wired.
- **Focus:** `CaptureSheet` already auto-focuses its textarea on open. No new code needed.
- **No-op when sheet open:** Cmd+K while CaptureSheet is open should be ignored, not toggled. Radix dialogs are open-state-driven, so calling `openCapture` again is a no-op there. Keep behavior; don't add toggle logic.
- **iOS/iPadOS Safari with bluetooth keyboard:** Cmd is the standard mac modifier; same handler works. No special-case needed.

---

## Help / discoverability

The shortcut needs to be findable. Options:

1. **Footer hint on first-time user**: small `⌘K to capture` chip on the home view for the first 7 days, dismissible. Cheap discoverability, doesn't clutter long-term.
2. **Settings → Keyboard shortcuts** doc page: add a route or settings tab listing every global shortcut. Half a day of work; defer to v1 if week 2 runs hot.
3. **Cmd+/ shows a key cheatsheet overlay**: standard Mac convention. Nice-to-have, defer to v1.

For week 2, do (1) only. The chip is 20 lines of JSX.

---

## Mobile fallback

On mobile, Cmd+K isn't a thing. The capture FAB in BottomNav is the equivalent — already shipped. No change needed.

If a user has an external keyboard on iPad, the global handler still fires correctly because `keydown` on `window` works across input contexts on iPadOS Safari.

---

## Testing

Manual:
1. From Memory view → Cmd+K → CaptureSheet opens, focus in textarea, no scroll jump.
2. From Settings view → Cmd+K → still works (no view-scoped handlers blocking).
3. Inside CaptureSheet textarea → Cmd+K → ignored (no nested open).
4. Cmd+Shift+K → OmniSearch opens.
5. Esc → closes whichever was open.
6. Repeat 20 times back-to-back. No leaks (DevTools → Performance → no growing heap).

Automated (`src/hooks/__tests__/useKeyboardShortcuts.test.tsx`):
- Renders a host component using the hook with mocked handlers.
- Dispatches `keydown` events with `{ metaKey: true, key: "k" }`, asserts `onCapture` fires.
- Dispatches `{ metaKey: true, shiftKey: true, key: "k" }`, asserts `onSearch` fires.
- Dispatches inside an `<input>` focus → asserts handlers do NOT fire.
- Cleanup test: unmount the component, dispatch the key, asserts no handlers called.

---

## Edge cases

| Case | Handling |
| ---- | -------- |
| User presses Cmd+K while a different modal is open (DetailModal, Settings) | Open CaptureSheet on top — Radix manages z-index stack, both should render correctly |
| Browser intercepts Cmd+K (some Linux Firefox versions bind it to URL bar) | `preventDefault` in handler; if the browser still intercepts, document Ctrl+K as alternate |
| Vim-style users have key remappers running | Out of scope. They've opted into custom bindings; respect that |
| User on a Capacitor Android wrap | No keyboard at all unless they pair one. FAB is the path. Hook still mounts but never fires |

---

## Out of scope (defer to v1 or later)

- Cmd+/ help cheatsheet overlay
- Per-view shortcuts (e.g. `j`/`k` to navigate the entry grid)
- Shortcut customization (let user rebind Cmd+K to OmniSearch instead)
- Recording shortcut usage in PostHog (`shortcut_used` event) — useful but not blocking; add if shortcuts drive activation in beta data

---

## Commit pattern

- `feat(shortcuts): useKeyboardShortcuts hook — Cmd+K capture, Shift+Cmd+K search`
- `feat(shortcuts): first-7-days discoverability chip` (optional, second commit if time)

---

## Why ship this in week 2 instead of post-launch

Power users (the ones who'll write reviews and tell their network) hit shortcuts within their first 5 minutes. If Cmd+K does nothing, they form an immediate "this is a basic note app" judgment that's hard to reverse. The cost is half a day; the upside is the first 50 power users feel at home.
