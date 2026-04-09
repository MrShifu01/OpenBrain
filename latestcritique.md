  Phase 1 + 2: Design Critique & Findings                                                                                                                     
  ---                                                                                                                                  
  Anti-Patterns Verdict — PASS                                                                                                         
  
  Does this look AI-generated? No. Specific clears:
  - Warm OKLCH charcoal + cream — not the AI cyan/purple palette
  - glass-panel removed (now solid, class is legacy comment only)
  - No gradient text, no glow borders, no glassmorphism
  - Lora + DM Sans — editorial pairing, not Inter/Roboto default
  - Custom SVG logo mark (E letterform + bronze dot) — distinctly branded
  - Warm tinted neutrals throughout, not pure #000/#fff

  One borderline call: the w-7 h-7 rounded-lg icon badge on every EntryCard is the "icon with rounded corners above every heading"     
  anti-pattern — but at 28px it reads as functional, not decorative. A close one.

  ---
  Design Health Score

  ┌───────┬──────────────────────────────┬───────┬─────────────────────────────────────────────────────────────────────────────────┐   
  │   #   │          Heuristic           │ Score │                                    Key Issue                                    │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 1     │ Visibility of System Status  │ 3     │ "Parsing..." is implementation-speak; otherwise solid                           │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 2     │ Match System / Real World    │ 3     │ Raw lowercase type labels ("note", "person") feel developer-facing              │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 3     │ User Control and Freedom     │ 3     │ No dirty-close warning in CaptureSheet; UndoToast + Esc/Cmd+Enter are solid     │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 4     │ Consistency and Standards    │ 3     │ Duplicate capture affordance: "New Entry" button + "Home" nav item point to the │   
  │       │                              │       │  same place                                                                     │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 5     │ Error Prevention             │ 2     │ No char-limit hint; no warning on close with unsaved capture text               │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 6     │ Recognition Rather Than      │ 3     │ Quick actions at 40% rest opacity — discoverability barrier                     │   
  │       │ Recall                       │       │                                                                                 │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 7     │ Flexibility and Efficiency   │ 3     │ Cmd+Enter shortcut, virtual scrolling; search not found in reviewed components  │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 8     │ Aesthetic and Minimalist     │ 3     │ Secondary (slate blue) creates cool/warm chromatic tension                      │   
  │       │ Design                       │       │                                                                                 │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 9     │ Error Recovery               │ 2     │ Generic error copy in capture; UndoToast is well-done                           │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ 10    │ Help and Documentation       │ 2     │ Good placeholder copy + hint; nothing beyond that                               │   
  ├───────┼──────────────────────────────┼───────┼─────────────────────────────────────────────────────────────────────────────────┤   
  │ Total │                              │ 27/40 │ Solid — no P0 blockers, meaningful P1–P2 gaps                                   │   
  └───────┴──────────────────────────────┴───────┴─────────────────────────────────────────────────────────────────────────────────┘   

  ---
  Overall Impression

  Genuinely distinctive system — warm OKLCH tokens, editorial typography, no AI slop. Technical UX bones are impressive (focus traps,  
  prefers-reduced-motion, 44px targets, UndoToast with RAF progress bar). The gaps are not visual noise but chromatic coherence,       
  capture flow friction, and discoverability. The brand personality is real; the execution is ~85% there.

  ---
  What's Working

  1. Color system — The warm charcoal dark + cream light is rare and executed well. oklch(11% 0.010 60) reads as aged espresso, not    
  generic dark. Light mode cream oklch(98.5% 0.009 85) is distinctly warm ivory, not blinding white.
  2. UndoToast — RAF-driven progress bar, undo on delete, 5s window, proper role="alert". This is a trust-building detail that tells   
  users their data is safe. Exactly right for a "trusted" brand.
  3. CaptureSheet accessibility — Focus trap implemented correctly, Esc-to-close, Cmd+Enter shortcut hint shown in footer, auto-focus  
  on open, preview cancel restores original text. Thoughtful.

  ---
  Priority Issues

  [P1] Secondary color (slate blue) creates cool/warm split
  - What: Tags, "Syncing" badge, and timeline dots all use oklch(60% 0.045 225) — a distinctly cool slate blue — alongside a warm amber
   primary (oklch(68% 0.09 75)). Two chromatic directions in one palette.
  - Why it matters: Brand promise is "warm, trusted." Slate blue reads as tech/corporate. Every tag badge and sync indicator pulls away
   from warmth. A user unconsciously feels the incoherence even if they can't name it.
  - Fix: Neutralize the secondary toward a warm grey (e.g., oklch(55% 0.02 75)) or shift hue toward muted terracotta. Tags don't need a
   distinct chromatic accent — they should recede, not compete with the primary.
  - Suggested command: /colorize

  [P2] Stacked modals on capture — CaptureSheet → PreviewModal
  - What: User opens CaptureSheet (bottom sheet), AI parses, then a second PreviewModal overlays it. Two modal layers.
  - Why it matters: Cognitively jarring — user is mid-thought, and suddenly a new dialog appears on top of the sheet they're already   
  in. This breaks the "calm, quick capture" promise.
  - Fix: Inline the preview within the sheet itself. Sheet expands downward to reveal editable title/tags before saving. No second     
  modal. Or — skip the preview entirely and let the UndoToast handle "wrong title? undo."
  - Suggested command: /distill

  [P2] Quick-action buttons hidden at 40% rest opacity
  - What: Pin + Delete buttons in EntryCard sit at opacity-40 at rest, opacity-100 on hover. At 40%, they are essentially invisible on 
  dark surfaces.
  - Why it matters: Users on mobile (primary use case!) can't hover. They won't discover Pin or Delete until they open the full detail 
  view. The most common destructive action is invisible.
  - Fix: Raise rest opacity to ~65–70%, or surface Pin as a persistent icon indicator (like the existing 📌 pinned indicator) rather   
  than a hidden hover button. For mobile: surface a long-press or swipe gesture.
  - Suggested command: /delight

  [P2] "Own Your Intelligence" tagline — tone mismatch
  - What: Shown in desktop sidebar (text-xs text-on-surface-variant/50 — muted, so low impact) and presumably on landing.
  - Why it matters: "Own Your Intelligence" is assertive, startup-pitch language. Brand personality is "Calm. Intelligent. Trusted."   
  Assertive ownership language is Notion circa 2020, not editorial calm. Minor in the app; potentially significant on landing page.    
  - Fix: Replace with something softer — "Your thinking, preserved." or "A quiet place for your ideas." Or remove it from the sidebar  
  entirely (the wordmark alone is sufficient).
  - Suggested command: /clarify

  [P3] Raw lowercase type labels in EntryCard
  - What: e.type displayed raw — "note", "person", "document", "secret", "reminder", "supplier" — in text-xs font-medium
  text-on-surface-variant.
  - Why it matters: Lowercase technical strings feel developer-facing. Minor but pulls the editorial feel downward.
  - Fix: Capitalize at render: {e.type.charAt(0).toUpperCase() + e.type.slice(1)}. Or replace with the icon alone (already shown) and  
  remove the text label.
  - Suggested command: /normalize

  ---
  Cognitive Load Check

  Nav items visible: Home, Grid, Suggest, Refine, Todos, Timeline, Vault, Chat = 8 primary items + Settings = 9 total.

  Working memory limit is ~7 ± 2. Nine items is one over. Additionally: "New Entry" button in sidebar + "Home" nav item both navigate  
  to capture — same destination, two affordances. Duplicate entry in cognitive budget.

  Failure count: 3 (nav exceeds limit, duplicate CTA, double-modal capture flow) → Moderate load.

  ---
  Persona Red Flags

  The On-the-Go Capturer (mobile, quick-thought moment — primary use case):
  - Opens app, taps somewhere to capture... but there's no persistent floating capture button. On mobile, capture is triggered by      
  navigating to "Home" view via bottom nav. Not immediately obvious.
  - AI parsing triggers PreviewModal stacked on bottom sheet — unexpected extra step mid-capture moment. ⚠️ Friction at the
  highest-stakes moment.
  - Pin/Delete hidden at ~40% opacity — mobile users can't hover, never discover these actions without going to detail view.

  The Knowledge Reviewer (desktop, scanning entries, organizing):
  - Sidebar has "New Entry" button AND "Home" nav item pointing to same place. Which is canonical?
  - EntryCards are visually identical regardless of type — scanning 50 notes/persons/documents, everything looks the same. No
  type-based visual differentiation beyond a tiny 28px badge.
  - 10px date text in Timeline view (text-[10px] uppercase tracking-widest) is below comfortable reading threshold, likely illegible on
   non-Retina displays. ⚠️ Accessibility risk.

  The First-Timer (discovering Everion):
  - Empty state not reviewed in code — unknown if it teaches the interface or just says "nothing here."
  - "Suggest," "Refine," "Todos," "Vault," "Chat" in nav — 5 feature areas with no explanation. What does "Refine" do? What's in the   
  Vault? Icon-only hints don't answer these.
  - Brain switcher slot in sidebar — what's a "brain"? No onboarding copy.

  ---
  Minor Observations

  - "Parsing..." status copy reveals implementation. Replace with "Reading your entry…" or "Thinking…" — warmer.
  - Tags displayed as #{tag} — the # prefix is informal. Consider plain tag or a subtle dot prefix for editorial feel.
  - text-[10px] in VirtualTimeline date column — should be text-xs (12px) minimum.
  - w-10 h-1 drag handle appears on desktop sheet too (lg breakpoint sheet becomes a floating dialog but keeps the handle) — purely    
  decorative and slightly odd in a floating dialog context.
  - UndoToast positioned bottom-24 on mobile — ensure it clears bottom nav bar on all devices.

  ---
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────←  ☐ Top priority  ☐ Scope  ✔ Submit  →
                                                                                                                                       27/40. Biggest issues: (1) slate-blue secondary clashing with warm amber brand, (2) double-modal capture flow, (3) hidden quick-actions on mobile. Which do you want to tackle first?                                                                                         
     
❯ 1. Warm the palette                                                                                                                  
     Fix the cool/warm chromatic split — neutralize secondary color so tags, sync badge, and timeline all feel warm amber, not         
     blue-grey. /colorize
  2. Simplify capture flow
     Collapse CaptureSheet + PreviewModal into a single expanding sheet — no stacked modals. /distill
  3. Surface quick actions
     Make Pin/Delete discoverable at rest (not hidden at 40% opacity), especially for mobile users who can't hover. /delight           
  4. All of the above
     Fix everything in priority order: palette → capture flow → quick actions → copy → normalization.
  5. Type something.