// File-capture progress toasts. Mirrors the BackgroundOpsToast contract but
// reads from useBackgroundCapture's externally-controlled `tasks` array.
//
// Originally a self-contained floating-card stack at bottom-24. Now a
// no-render hook that diff's the task list each render and pushes sonner
// toasts via the shared <Toaster> mounted in Everion.tsx — single z-index,
// single dismiss queue, single animation system.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { BackgroundTask } from "../hooks/useBackgroundCapture";

const STATUS_LABEL: Record<string, string> = {
  extracting: "Reading…",
  classifying: "Classifying…",
  saving: "Saving…",
  done: "Saved",
  error: "Failed",
};

interface Props {
  tasks: BackgroundTask[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export function BackgroundTaskToast({ tasks, onDismiss }: Props) {
  // Track each task's last-known status so we only emit on transitions,
  // not on every parent re-render.
  const seenStatus = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const currentIds = new Set(tasks.map((t) => t.id));

    // Dismiss toasts for tasks no longer in the list (e.g. after dismissAll
    // clears local state).
    for (const id of Array.from(seenStatus.current.keys())) {
      if (!currentIds.has(id)) {
        toast.dismiss(id);
        seenStatus.current.delete(id);
      }
    }

    // Emit / update toasts for current tasks. Same `id` between calls makes
    // sonner update the existing toast in place — loading → success/error.
    for (const task of tasks) {
      const prev = seenStatus.current.get(task.id);
      if (prev === task.status) continue;

      const title = task.entryTitle || task.filename || "File";
      const dismissOpt = { onDismiss: () => onDismiss(task.id) };

      if (task.status === "done") {
        toast.success(title, {
          id: task.id,
          description: task.warning ? `AI failed: ${task.warning}` : STATUS_LABEL.done,
          ...dismissOpt,
        });
      } else if (task.status === "error") {
        toast.error(title, {
          id: task.id,
          description: task.error || STATUS_LABEL.error,
          ...dismissOpt,
        });
      } else {
        toast.loading(title, {
          id: task.id,
          description: STATUS_LABEL[task.status],
        });
      }
      seenStatus.current.set(task.id, task.status);
    }
  }, [tasks, onDismiss]);

  return null;
}
