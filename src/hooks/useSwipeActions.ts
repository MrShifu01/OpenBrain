import { useState, useRef } from "react";
import type { TouchEvent } from "react";

interface UseSwipeActionsOptions {
  /** Pixel width of a single action button revealed under the row. */
  actionWidth: number;
  /** Number of action buttons (e.g. pin + delete = 2). Zero disables swipe. */
  actionCount: number;
}

interface SwipeActionsApi {
  swipeX: number;
  dragging: boolean;
  isOpen: boolean;
  totalWidth: number;
  onTouchStart: (ev: TouchEvent) => void;
  onTouchMove: (ev: TouchEvent) => void;
  onTouchEnd: () => void;
  closeSwipe: () => void;
}

/**
 * Swipe-to-reveal touch handler shared by EntryCard and EntryRow.
 *
 * Discriminates dx vs dy on first touch (cancels on vertical scroll), clamps
 * translation between [-totalWidth, 0], and snaps to the nearest end on
 * release. The 5px deadzone matches iOS's own pan-gesture threshold so the
 * row doesn't visibly jitter when the user means to scroll the list.
 */
export function useSwipeActions({
  actionWidth,
  actionCount,
}: UseSwipeActionsOptions): SwipeActionsApi {
  const [swipeX, setSwipeX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const startSwipeRef = useRef(0);
  const draggingRef = useRef(false);

  const totalWidth = actionCount * actionWidth;
  const isOpen = swipeX < -10;

  const onTouchStart = (ev: TouchEvent) => {
    touchStartRef.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    startSwipeRef.current = swipeX;
    draggingRef.current = false;
  };

  const onTouchMove = (ev: TouchEvent) => {
    if (totalWidth === 0) return;
    const dx = ev.touches[0].clientX - touchStartRef.current.x;
    const dy = ev.touches[0].clientY - touchStartRef.current.y;
    if (!draggingRef.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      draggingRef.current = true;
      setDragging(true);
    }
    setSwipeX(Math.min(0, Math.max(-totalWidth, startSwipeRef.current + dx)));
  };

  const onTouchEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    setSwipeX((prev) => (prev < -(totalWidth / 2) ? -totalWidth : 0));
  };

  const closeSwipe = () => setSwipeX(0);

  return {
    swipeX,
    dragging,
    isOpen,
    totalWidth,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    closeSwipe,
  };
}
