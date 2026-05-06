// Memo'd list row for an entry. Used by VirtualGrid in `viewMode=list`.
// Split out of EntryList.tsx alongside EntryCard so the virtualisers stay
// readable. Pure presentation — no fetching or mutation.

import { memo } from "react";
import type { Entry } from "../types";
import { resolveIcon } from "../lib/typeIcons";
import { isPendingEnrichment } from "../lib/enrichFlags";
import { getAdminPrefs } from "../lib/adminPrefs";
import { getCachedIsAdmin } from "../lib/userEmailCache";
import { useSwipeActions } from "../hooks/useSwipeActions";
import { IconPin, EnrichingDot, EnrichFlagChips } from "./EntryListBits";
import { Button } from "./ui/button";

export const EntryRow = memo(function EntryRow({
  entry: e,
  onSelect,
  onPin,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
  typeIcons = {},
}: {
  entry: Entry;
  onSelect: (e: Entry) => void;
  onPin?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  typeIcons?: Record<string, string>;
}) {
  const isPinned = !!e.pinned;
  const emoji = resolveIcon(e.type, typeIcons);
  const showAdminFlags =
    getCachedIsAdmin() && e.type !== "secret" && getAdminPrefs().showEnrichmentChips;

  const ACTION_W = 64;
  const actionCount = (onPin ? 1 : 0) + (onDelete ? 1 : 0);
  const TOTAL_W = actionCount * ACTION_W;

  const { swipeX, dragging, isOpen, onTouchStart, onTouchMove, onTouchEnd, closeSwipe } =
    useSwipeActions({ actionWidth: ACTION_W, actionCount });

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 10,
        background: selected ? "var(--ember-wash)" : "var(--surface)",
        border: `1px solid ${selected ? "var(--ember)" : "var(--line-soft)"}`,
        borderLeft: isPinned ? "2px solid var(--ember)" : undefined,
        transition: "border-color 180ms, background 180ms",
      }}
    >
      {/* Swipe action panel — sits behind the row, revealed on swipe */}
      {TOTAL_W > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: TOTAL_W,
            display: "flex",
          }}
        >
          {onPin && (
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onPin(e);
                closeSwipe();
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "var(--ember)",
                border: "none",
                cursor: "pointer",
                color: "#fff",
                fontFamily: "var(--f-sans)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              <svg
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M15 3 21 9l-4 1-4 4-1 5-3-3-5 5-1-1 5-5-3-3 5-1 4-4z" />
              </svg>
              {isPinned ? "Unpin" : "Pin"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete(e);
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "var(--blood)",
                border: "none",
                cursor: "pointer",
                color: "#fff",
                fontFamily: "var(--f-sans)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              <svg
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
              </svg>
              Delete
            </button>
          )}
        </div>
      )}

      {/* Row content — slides left on swipe */}
      <article
        tabIndex={0}
        onClick={() => {
          if (isOpen) {
            closeSwipe();
            return;
          }
          selectMode ? onToggleSelect?.(e.id) : onSelect(e);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Escape") {
            closeSwipe();
            return;
          }
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            selectMode ? onToggleSelect?.(e.id) : onSelect(e);
          }
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label={`Open entry: ${e.title}`}
        {...(isPinned ? { "data-pinned": "true" } : {})}
        className="group press flex w-full cursor-pointer items-center gap-3"
        style={{
          padding: "12px 16px",
          // Selected rows get the same ember-wash fill as the grid card so
          // both views read the same in Select mode.
          background: selected ? "var(--ember-wash)" : "var(--surface)",
          transform: `translateX(${swipeX}px)`,
          transition: dragging
            ? "none"
            : "transform 220ms cubic-bezier(0.25, 1, 0.5, 1), background 180ms",
          touchAction: dragging ? "none" : "pan-y",
          willChange: dragging ? "transform" : "auto",
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
          {emoji}
        </span>
        <span
          className="f-sans"
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-faint)",
            flexShrink: 0,
          }}
        >
          {e.type}
        </span>
        {isPinned && <span style={{ color: "var(--ember)", flexShrink: 0 }}>{IconPin}</span>}
        <span
          className="f-serif min-w-0 flex-1 truncate"
          style={{ fontSize: 15, fontWeight: 450, color: "var(--ink)" }}
        >
          {e.title}
        </span>
        {isPendingEnrichment(e) && <EnrichingDot />}
        {showAdminFlags && <EnrichFlagChips entry={e} />}
        {/* Desktop hover-reveal actions */}
        {(onPin || onDelete) && (
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {onPin && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onPin(e);
                }}
                aria-label={isPinned ? "Unpin" : "Pin"}
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  />
                </svg>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDelete(e);
                }}
                aria-label="Delete"
                className="entry-card__delete"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </Button>
            )}
          </div>
        )}
      </article>
    </div>
  );
});
