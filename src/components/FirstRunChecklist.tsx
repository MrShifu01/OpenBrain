import { useFirstRunChecklist, type ChecklistAction } from "../hooks/useFirstRunChecklist";

interface FirstRunChecklistProps {
  entryCount: number;
  brainCount: number;
  /** Active brain id — scopes the per-brain "ever-completed" flag. */
  brainId?: string;
  /** Personal brain renders the full checklist; shared brains render
   *  only capture5 + persona + vault. */
  isPersonalBrain: boolean;
  onNavigate: (view: string) => void;
  onOpenCapture: () => void;
  onCreateBrain: () => void;
}

function resolveAction(
  action: ChecklistAction,
  cb: { onNavigate: (v: string) => void; onOpenCapture: () => void; onCreateBrain: () => void },
) {
  switch (action.kind) {
    case "navigate":
      return () => cb.onNavigate(action.view);
    case "settings":
      return () => {
        // Settings tab routes via URL params (see SettingsView.tsx tab parser).
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", action.tab);
          window.history.replaceState({}, "", url.toString());
        } catch {
          /* ignore */
        }
        cb.onNavigate("settings");
      };
    case "openCapture":
      return cb.onOpenCapture;
    case "createBrain":
      return cb.onCreateBrain;
  }
}

export default function FirstRunChecklist({
  entryCount,
  brainCount,
  brainId,
  isPersonalBrain,
  onNavigate,
  onOpenCapture,
  onCreateBrain,
}: FirstRunChecklistProps) {
  const state = useFirstRunChecklist({
    entryCount,
    brainCount,
    brainId,
    isPersonalBrain,
  });

  // Once the checklist has ever reached allDone for THIS brain, render
  // nothing — no card, no "bring back" link. Persisted in localStorage
  // per brain id so it stays gone across refreshes and re-mounts.
  if (state.hidden) return null;

  if (state.dismissed && !state.allDone) {
    return (
      <button
        type="button"
        onClick={state.undismiss}
        className="press f-sans"
        style={{
          background: "transparent",
          border: "1px dashed var(--line-soft)",
          borderRadius: 12,
          padding: "10px 14px",
          color: "var(--ink-faint)",
          fontSize: 12,
          fontStyle: "italic",
          cursor: "pointer",
        }}
      >
        bring back the setup checklist ({state.doneCount}/{state.totalCount} done)
      </button>
    );
  }

  if (state.dismissed && state.allDone) return null;

  const headerText = state.allDone
    ? "you're set up."
    : `Set up your brain — ${state.doneCount} of ${state.totalCount} done`;

  return (
    <section
      aria-label="First run checklist"
      style={{
        background: "var(--surface-high)",
        border: "1px solid var(--line-soft)",
        borderRadius: 18,
        padding: "20px 22px 16px",
        boxShadow: "var(--lift-1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="f-serif"
            style={{
              fontSize: 19,
              fontWeight: 450,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {headerText}
          </div>
          {!state.allDone && (
            <div
              className="f-serif"
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              a few finishing touches and your brain feels custom-built for you.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={state.dismiss}
          className="press f-sans"
          aria-label="Dismiss checklist"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ink-faint)",
            fontSize: 12,
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
        >
          dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div
        aria-hidden="true"
        style={{
          height: 3,
          borderRadius: 2,
          background: "var(--line-soft)",
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${Math.round(state.progress * 100)}%`,
            height: "100%",
            background: state.allDone ? "var(--moss)" : "var(--ember)",
            transition: "width 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>

      {/* Items */}
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {state.items.map((item) => {
          const onClick = resolveAction(item.action, {
            onNavigate,
            onOpenCapture,
            onCreateBrain,
          });
          return (
            <li key={item.id} style={{ margin: 0 }}>
              <button
                type="button"
                onClick={onClick}
                disabled={item.done}
                className="press"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: 0,
                  borderRadius: 10,
                  cursor: item.done ? "default" : "pointer",
                  textAlign: "left",
                  opacity: item.done ? 0.6 : 1,
                  transition: "background 180ms",
                }}
                onMouseEnter={(e) => {
                  if (!item.done) e.currentTarget.style.background = "var(--surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Status dot / check */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: item.done ? "0" : "1.5px solid var(--line)",
                    background: item.done ? "var(--moss)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  {item.done && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                  )}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="f-sans"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                      textDecoration: item.done ? "line-through" : "none",
                      textDecorationColor: "var(--ink-faint)",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    className="f-serif"
                    style={{
                      fontSize: 12,
                      fontStyle: "italic",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.body}
                  </div>
                </div>

                {!item.done && (
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      color: "var(--ink-faint)",
                      fontSize: 16,
                      marginTop: 2,
                    }}
                  >
                    →
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {state.allDone && (
        <div
          className="f-serif"
          style={{
            marginTop: 14,
            padding: "10px 12px",
            fontSize: 13,
            fontStyle: "italic",
            color: "var(--ink-soft)",
            textAlign: "center",
            background: "var(--surface)",
            borderRadius: 10,
          }}
        >
          everything's wired up. dismiss this card to clear it for good.
        </div>
      )}
    </section>
  );
}
