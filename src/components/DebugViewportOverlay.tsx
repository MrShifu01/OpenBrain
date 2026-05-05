import { useEffect, useState } from "react";

// TEMPORARY debug overlay — paints real values on top of every page so we can
// diagnose the bottom-nav gap issue without remote DevTools. Strip once the
// fix lands. Sits at the very top above the safe-area-inset-top so the
// status bar doesn't cover it.

interface Snapshot {
  innerHeight: number;
  innerWidth: number;
  vvHeight: number | string;
  vvWidth: number | string;
  vvOffsetTop: number | string;
  vvOffsetLeft: number | string;
  insetTop: number;
  insetBottom: number;
  insetLeft: number;
  insetRight: number;
  displayMode: string;
  navRect: { top: number; bottom: number; height: number; width: number } | null;
  navComputed: { bottom: string; paddingBottom: string; height: string } | null;
}

function readSnapshot(): Snapshot {
  const probe = (which: "top" | "bottom" | "left" | "right") => {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;${which}:0;height:env(safe-area-inset-${which},0px);width:env(safe-area-inset-${which},0px);`;
    document.body.appendChild(el);
    const v = which === "top" || which === "bottom" ? el.offsetHeight : el.offsetWidth;
    document.body.removeChild(el);
    return v;
  };

  const nav = document.querySelector(".bottom-nav-mobile") as HTMLElement | null;
  const navRect = nav
    ? {
        top: Math.round(nav.getBoundingClientRect().top),
        bottom: Math.round(nav.getBoundingClientRect().bottom),
        height: Math.round(nav.getBoundingClientRect().height),
        width: Math.round(nav.getBoundingClientRect().width),
      }
    : null;
  const navComputed = nav
    ? {
        bottom: getComputedStyle(nav).bottom,
        paddingBottom: getComputedStyle(nav).paddingBottom,
        height: getComputedStyle(nav).height,
      }
    : null;

  let displayMode = "browser";
  if (window.matchMedia("(display-mode: standalone)").matches) displayMode = "standalone";
  else if (window.matchMedia("(display-mode: minimal-ui)").matches) displayMode = "minimal-ui";
  else if (window.matchMedia("(display-mode: fullscreen)").matches) displayMode = "fullscreen";

  return {
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    vvHeight: window.visualViewport ? Math.round(window.visualViewport.height) : "n/a",
    vvWidth: window.visualViewport ? Math.round(window.visualViewport.width) : "n/a",
    vvOffsetTop: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : "n/a",
    vvOffsetLeft: window.visualViewport ? Math.round(window.visualViewport.offsetLeft) : "n/a",
    insetTop: probe("top"),
    insetBottom: probe("bottom"),
    insetLeft: probe("left"),
    insetRight: probe("right"),
    displayMode,
    navRect,
    navComputed,
  };
}

export default function DebugViewportOverlay() {
  const [snap, setSnap] = useState<Snapshot>(() => readSnapshot());
  const [readings, setReadings] = useState<Snapshot[]>(() => [readSnapshot()]);

  useEffect(() => {
    const measure = () => {
      const next = readSnapshot();
      setSnap(next);
      // Append to history only when something visible actually changes.
      setReadings((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.innerHeight === next.innerHeight &&
          last.vvHeight === next.vvHeight &&
          last.insetBottom === next.insetBottom &&
          last.navRect?.bottom === next.navRect?.bottom
        ) {
          return prev;
        }
        return [...prev, next].slice(-6);
      });
    };
    measure();
    requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 500);
    const t3 = setTimeout(measure, 1500);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.92)",
        color: "#0f0",
        font: "10px/1.3 ui-monospace, monospace",
        padding: "calc(env(safe-area-inset-top, 0px) + 4px) 8px 6px",
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`mode: ${snap.displayMode}  inH: ${snap.innerHeight}  vvH: ${snap.vvHeight}  vvOffTop: ${snap.vvOffsetTop}
inset top/bottom: ${snap.insetTop} / ${snap.insetBottom}    L/R: ${snap.insetLeft} / ${snap.insetRight}
nav rect (top/bottom/h/w): ${snap.navRect ? `${snap.navRect.top} / ${snap.navRect.bottom} / ${snap.navRect.height} / ${snap.navRect.width}` : "no .bottom-nav-mobile"}
nav css (bottom/pb/h): ${snap.navComputed ? `${snap.navComputed.bottom} / ${snap.navComputed.paddingBottom} / ${snap.navComputed.height}` : "n/a"}
gap below nav: ${snap.navRect ? snap.innerHeight - snap.navRect.bottom : "?"}px
readings: ${readings.length}  last innerH/vvH/inB: ${readings.map((r) => `${r.innerHeight}/${r.vvHeight}/${r.insetBottom}`).join(" → ")}`}
      {/* RED PROBE STRIP — fixed bottom: -28; height: 28. If iOS renders
          fixed elements past innerHeight into the safe-area zone, this
          strip will be visible at the very bottom of the screen. If iOS
          clips fixed elements at innerHeight, the strip will not appear.
          Decisive test for which fix path to take. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: "-28px",
          left: 0,
          right: 0,
          height: "28px",
          background: "red",
          color: "white",
          zIndex: 99998,
          pointerEvents: "none",
          font: "11px/28px monospace",
          textAlign: "center",
        }}
      >
        RED PROBE — fixed bottom:-28; height:28
      </div>
    </div>
  );
}
