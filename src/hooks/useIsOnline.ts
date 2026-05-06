import { useEffect, useState } from "react";

// Subscribe to navigator.onLine. Lighter than useOfflineSync — no IndexedDB,
// no queue, no drain. Use this when a component just needs to know whether
// to disable a submit button or render a calm "needs internet" hint.
//
// Components that already pull `isOnline` through props (DesktopSidebar,
// MobileHeader, CaptureSheet) should keep using the prop — props win when
// the parent already manages the state. This hook is for leaf components
// that don't have a parent threading isOnline through.
export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
