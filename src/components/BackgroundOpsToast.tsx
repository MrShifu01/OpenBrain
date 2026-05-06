// Generic background-ops toast bridge. Mounts once in Everion.tsx, reads
// from useBackgroundOps(), and pushes each running/done/error task into the
// shared sonner Toaster. Returns null — the JSX lives in <Toaster>.
//
// Originally rendered a custom floating stack at bottom-44; that site is
// now retired in favour of the single sonner queue mounted at the bottom
// of the screen.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useBackgroundOps } from "../hooks/useBackgroundOps";

function progressDescription(p: { current: number; total?: number; suffix?: string }): string {
  const head = p.total ? `${p.current} / ${p.total}` : `${p.current}`;
  return p.suffix ? `${head} · ${p.suffix}` : `${head}…`;
}

export function BackgroundOpsToast() {
  const { tasks, dismissTask } = useBackgroundOps();
  const seenStatus = useRef<Map<string, string>>(new Map());
  // Progress changes live inside `running` status; track the last-emitted
  // progress string per task so we update sonner only when the text changes.
  const lastProgress = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const currentIds = new Set(tasks.map((t) => t.id));

    for (const id of Array.from(seenStatus.current.keys())) {
      if (!currentIds.has(id)) {
        toast.dismiss(id);
        seenStatus.current.delete(id);
        lastProgress.current.delete(id);
      }
    }

    for (const task of tasks) {
      const prev = seenStatus.current.get(task.id);
      const progressText = task.progress ? progressDescription(task.progress) : "Working…";
      const dismissOpt = { onDismiss: () => dismissTask(task.id) };

      if (task.status === "done") {
        if (prev !== "done") {
          toast.success(task.label, {
            id: task.id,
            description: task.result || "Done",
            ...dismissOpt,
            ...(task.action
              ? {
                  action: {
                    label: task.action.label,
                    onClick: () => {
                      window.dispatchEvent(
                        new CustomEvent(task.action!.event, { detail: task.action!.detail }),
                      );
                      dismissTask(task.id);
                    },
                  },
                }
              : {}),
          });
          seenStatus.current.set(task.id, "done");
        }
      } else if (task.status === "error") {
        if (prev !== "error") {
          toast.error(task.label, {
            id: task.id,
            description: task.error || "Failed",
            ...dismissOpt,
          });
          seenStatus.current.set(task.id, "error");
        }
      } else {
        // running — re-emit if status changed OR if progress text changed.
        const lastProg = lastProgress.current.get(task.id);
        if (prev !== "running" || lastProg !== progressText) {
          toast.loading(task.label, {
            id: task.id,
            description: progressText,
          });
          seenStatus.current.set(task.id, "running");
          lastProgress.current.set(task.id, progressText);
        }
      }
    }
  }, [tasks, dismissTask]);

  return null;
}
