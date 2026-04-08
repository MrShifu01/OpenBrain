import { useState, useEffect } from "react";
import { callAI } from "../lib/ai";
import { extractNudgeText } from "../lib/extractNudgeText";
import { PROMPTS } from "../config/prompts";
import type { Entry, Brain } from "../types";

interface UseNudgeParams {
  entriesLoaded: boolean;
  entries: Entry[];
  activeBrain: Brain | null;
}

export function useNudge({ entriesLoaded, entries, activeBrain }: UseNudgeParams) {
  const [nudge, setNudge] = useState<string | null>(
    () => sessionStorage.getItem("openbrain_nudge") || null,
  );

  useEffect(() => {
    if (!entriesLoaded || sessionStorage.getItem("openbrain_nudge") !== null) return;

    const recent = entries.slice(0, 30).map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      tags: e.tags,
      metadata: e.metadata,
      created_at: e.created_at,
    }));

    // Detect potential duplicates
    const titlesByDate: Record<string, typeof recent> = {};
    for (const e of recent) {
      const dateKey = e.created_at?.slice(0, 10) || "unknown";
      titlesByDate[dateKey] = titlesByDate[dateKey] || [];
      titlesByDate[dateKey].push(e);
    }
    const duplicates: string[] = [];
    for (const dayEntries of Object.values(titlesByDate)) {
      const byTitle: Record<string, typeof recent> = {};
      for (const e of dayEntries) {
        byTitle[e.title] = byTitle[e.title] || [];
        byTitle[e.title].push(e);
      }
      for (const sameTitle of Object.values(byTitle)) {
        if (sameTitle.length > 1 && new Set(sameTitle.map((x) => x.type)).size > 1) {
          duplicates.push(
            `"${sameTitle[0].title}" appears as both ${sameTitle.map((x) => x.type).join(" and ")} on same day`,
          );
        }
      }
    }

    // Detect upcoming expirations (within 90 days)
    const now = new Date();
    const expirations: string[] = [];
    for (const e of recent) {
      const meta = e.metadata || {};
      const dateFields = [
        { key: "expiry_date", label: "expires" },
        { key: "warranty_expiration", label: "warranty expires" },
        { key: "due_date", label: "due" },
      ];
      for (const { key, label } of dateFields) {
        const dateStr = (meta as any)[key];
        if (dateStr) {
          const date = new Date(dateStr);
          const daysUntil = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil > 0 && daysUntil <= 90) {
            expirations.push(`${e.title} ${label} in ${daysUntil} days`);
          }
        }
      }
    }

    const gaps = [...duplicates.slice(0, 1), ...expirations.slice(0, 1)];
    const gapContext = gaps.length ? `\n\nDetected gaps: ${gaps.join("; ")}` : "";

    callAI({
      max_tokens: 200,
      system: PROMPTS.NUDGE,
      brainId: activeBrain?.id,
      messages: [
        {
          role: "user",
          content: `My recent memories:\n${JSON.stringify(recent)}\n\nWhat should I know right now?${gapContext}`,
        },
      ],
    })
      .then((r: any) => r.json())
      .then((data: any) => {
        const text = extractNudgeText(data);
        if (text) {
          setNudge(text);
          sessionStorage.setItem("openbrain_nudge", text);
        } else {
          sessionStorage.setItem("openbrain_nudge", "");
        }
      })
      .catch(() => sessionStorage.setItem("openbrain_nudge", ""));
  }, [entriesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return { nudge, setNudge };
}
