# PERF_PR_1 — Code-split 8 views with React.lazy

## Problem
All 8 views (Grid, Suggest, Calendar, Todos, Timeline, Graph, Chat, Settings)
are compiled into a single 448KB bundle. Users loading the app pay the full
parse + eval cost even though only the Grid view is visible on first load.

## Fix
Wrap each view component in `React.lazy()` and a `<Suspense>` boundary.
Vite will automatically split each lazy import into its own chunk.

## Steps

### 1. Extract each view into its own file
Move these components to `src/views/`:
- `SuggestionsView` → `src/views/SuggestionsView.jsx`
- `CalendarView`    → `src/views/CalendarView.jsx`
- `TodoView`        → `src/views/TodoView.jsx`
- `GraphView`       → `src/views/GraphView.jsx`
- `EntryModal`      → `src/views/EntryModal.jsx`

The Grid (inline in main app) and Chat/Settings (small) can stay inline.

### 2. Replace imports at top of OpenBrain.jsx
```js
// Before: direct component definitions inside OpenBrain.jsx
// After: lazy imports

import { lazy, Suspense } from "react";

const SuggestionsView = lazy(() => import("./views/SuggestionsView"));
const CalendarView    = lazy(() => import("./views/CalendarView"));
const TodoView        = lazy(() => import("./views/TodoView"));
const GraphView       = lazy(() => import("./views/GraphView"));
const EntryModal      = lazy(() => import("./views/EntryModal"));
```

### 3. Wrap conditional renders in Suspense
```jsx
// Before
{view === "suggest" && <SuggestionsView ... />}
{view === "calendar" && <CalendarView entries={entries} />}
{view === "todos" && <TodoView />}
{view === "graph" && <GraphView onSelect={...} />}

// After
{view === "suggest" && (
  <Suspense fallback={<div style={{ color: "#555", padding: 40, textAlign: "center" }}>Loading…</div>}>
    <SuggestionsView ... />
  </Suspense>
)}
// ... same pattern for calendar, todos, graph, EntryModal
```

## Expected impact
- Initial bundle drops from 448KB → ~180-220KB (60% smaller)
- SuggestionsView + CalendarView are the heaviest — each should split to ~40-60KB
- First contentful paint noticeably faster on slow connections

## Notes
- `SUGGESTIONS` data array (imported by SuggestionsView) will move to that chunk
- `INITIAL_ENTRIES` + `LINKS` + `TC`/`PC` constants must stay in the main file
  (they are referenced by Grid and Graph)
- Install nothing — this uses built-in Vite code splitting
