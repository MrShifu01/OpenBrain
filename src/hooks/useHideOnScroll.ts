import { useEffect, useState } from "react";

// Auto-hide-on-scroll hook shared by MobileHeader and MemoryHeader so
// both components reach the same `hidden` decision against the same
// scroll position. Without sharing, each would run its own scroll
// listener; minor differences in dispatch order would let the filter
// row lag the header by a frame and read as detached.
//
// Threshold of 60px means a short flick at the top doesn't hide the
// chrome — only meaningful intent to read deeper. dy gates >4 / <-4
// kill jitter from iOS rubber-band.
//
// Capture-phase document listener catches scroll events bubbling from
// any descendant scroll container; window listener catches the page
// scroll path. Multi-source readScrollY covers every browser quirk.

function readScrollY(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(
    window.scrollY || 0,
    window.pageYOffset || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0,
  );
}

export function useHideOnScroll(threshold = 60): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = readScrollY();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = readScrollY();
        const dy = y - lastY;
        if (y > threshold && dy > 4) setHidden(true);
        else if (dy < -4 || y < threshold) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [threshold]);
  return hidden;
}

// Match-media hook returning whether viewport is below the lg breakpoint
// (1024px in Tailwind 4). Used to scope auto-hide-on-scroll to mobile —
// desktop scroll should leave the chrome alone.
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
