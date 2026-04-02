# PERF_PR_2 — Virtualise entry grid and timeline

## Problem
Grid and Timeline both call `.map()` over the full filtered entries array and
mount every item as a real DOM node. At 25 entries this is invisible. At 200+
entries (a realistic 3-month target) it causes layout thrashing on every
filter/search change and scroll jank.

## Fix
Use `@tanstack/react-virtual` to only render the ~5-10 cards visible in the
viewport at any time.

## Install
```bash
npm install @tanstack/react-virtual
```

## Grid virtualisation

```jsx
import { useVirtualizer } from "@tanstack/react-virtual";

// Inside the grid section, replace the CSS grid .map() with:
function VirtualGrid({ filtered, setSelected }) {
  const parentRef = useRef(null);

  // Estimate 2 columns on desktop, 1 on mobile
  const COLS = window.innerWidth >= 640 ? 2 : 1;
  const rows = [];
  for (let i = 0; i < filtered.length; i += COLS) {
    rows.push(filtered.slice(i, i + COLS));
  }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,   // estimated card height in px
    overscan: 3,
  });

  return (
    <div ref={parentRef} style={{ height: "70vh", overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map(vRow => (
          <div
            key={vRow.index}
            style={{
              position: "absolute",
              top: vRow.start,
              left: 0,
              right: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 12,
              padding: "0 0 12px",
            }}
          >
            {rows[vRow.index].map(e => (
              <EntryCard key={e.id} entry={e} onClick={() => setSelected(e)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Extract the existing card JSX (lines 887–907 of OpenBrain.jsx) into an
`EntryCard` component and replace the grid `.map()` with `<VirtualGrid>`.

## Timeline virtualisation

```jsx
function VirtualTimeline({ sorted, setSelected }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: "70vh", overflow: "auto", position: "relative", paddingLeft: 24 }}>
      <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: "linear-gradient(180deg,#4ECDC4,#FF6B35,#A29BFE)" }} />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map(vItem => {
          const e = sorted[vItem.index];
          const cfg = TC[e.type] || TC.note;
          return (
            <div
              key={e.id}
              style={{ position: "absolute", top: vItem.start, left: 0, right: 0, paddingLeft: 20, cursor: "pointer" }}
              onClick={() => setSelected(e)}
            >
              <div style={{ position: "absolute", left: -3, top: 6, width: 12, height: 12, borderRadius: "50%", background: cfg.c, border: "2px solid #0f0f23" }} />
              <p style={{ fontSize: 10, color: "#666", margin: "0 0 2px" }}>{fmtD(e.created_at)}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{cfg.i}</span>
                <span style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}>{e.title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Expected impact
- Grid render time: O(n) → O(viewport) — renders ~10 cards regardless of total count
- Scroll performance: smooth at 500+ entries
- Memory: ~90% fewer DOM nodes when entry count exceeds 100
