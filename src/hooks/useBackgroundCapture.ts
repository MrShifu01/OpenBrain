import { useState, useCallback, useRef } from "react";
import { extractTextFromFile } from "../lib/fileExtract";
import { callAI } from "../lib/ai";
import { authFetch } from "../lib/authFetch";
import { getEmbedHeaders } from "../lib/aiSettings";
import { parseAISplitResponse } from "../lib/fileSplitter";
import { PROMPTS } from "../config/prompts";
import type { Entry } from "../types";

export type TaskStatus = "extracting" | "classifying" | "saving" | "done" | "error";

export interface BackgroundTask {
  id: string;
  filename: string;
  status: TaskStatus;
  error?: string;
  entryTitle?: string;
}

const FILE_CONTENT_LIMIT = 6000;

function extractJSON(text: string): string {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const m = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return m ? m[1] : cleaned;
}

export function useBackgroundCapture() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const taskIdRef = useRef(0);

  const updateTask = useCallback((id: string, update: Partial<BackgroundTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));
  }, []);

  const dismissTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== "done" && t.status !== "error"));
  }, []);

  const processFiles = useCallback(
    async (files: File[], brainId: string | undefined, onCreated: (entry: Entry) => void) => {
      // Create task entries immediately
      const newTasks: BackgroundTask[] = files.map((f) => ({
        id: String(++taskIdRef.current),
        filename: f.name,
        status: "extracting" as TaskStatus,
      }));
      setTasks((prev) => [...prev, ...newTasks]);

      // Process each file independently
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const taskId = newTasks[i].id;

        try {
          // Step 1: Extract text
          updateTask(taskId, { status: "extracting" });
          const rawText = await extractTextFromFile(file);
          if (!rawText.trim()) {
            updateTask(taskId, { status: "error", error: "No text extracted from file" });
            continue;
          }

          const content = rawText.length > FILE_CONTENT_LIMIT
            ? rawText.slice(0, FILE_CONTENT_LIMIT) + "\n…[truncated]"
            : rawText;
          const input = `[File: ${file.name}]\n${content}`;

          // Step 2: AI classify
          updateTask(taskId, { status: "classifying" });
          const aiRes = await callAI({
            system: PROMPTS.CAPTURE,
            max_tokens: 800,
            brainId,
            messages: [{ role: "user", content: input }],
          });
          const aiData = await aiRes.json();

          if (!aiRes.ok) {
            const errMsg = aiData?.error?.message || `AI error ${aiRes.status}`;
            updateTask(taskId, { status: "error", error: errMsg });
            continue;
          }

          const aiText = aiData.content?.[0]?.text || aiData.choices?.[0]?.message?.content || "";
          if (!aiText) {
            updateTask(taskId, { status: "error", error: "AI returned empty response" });
            continue;
          }

          // Try to parse AI response — may return object or array
          let entries: Array<{ title: string; content?: string; type?: string; tags?: string[]; metadata?: Record<string, unknown> }> = [];
          try {
            const jsonStr = extractJSON(aiText);
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
              entries = parsed.filter((e: any) => e?.title);
            } else if (parsed?.title) {
              entries = [parsed];
            } else {
              // Fall back to fileSplitter
              entries = parseAISplitResponse(aiText);
            }
          } catch {
            entries = parseAISplitResponse(aiText);
          }

          if (entries.length === 0) {
            // Save raw as note
            entries = [{ title: file.name.replace(/\.[^.]+$/, ""), content: rawText, type: "note" }];
          }

          // Step 3: Save all entries
          updateTask(taskId, { status: "saving" });
          const embedHeaders = getEmbedHeaders();
          for (const entry of entries) {
            const res = await authFetch("/api/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(embedHeaders || {}) },
              body: JSON.stringify({
                p_title: entry.title,
                p_content: entry.content || "",
                p_type: entry.type || "note",
                p_metadata: entry.metadata || {},
                p_tags: entry.tags || [],
                p_brain_id: brainId,
              }),
            });
            if (res.ok) {
              const result = await res.json();
              onCreated({
                id: result?.id || Date.now().toString(),
                title: entry.title,
                content: entry.content || "",
                type: (entry.type || "note") as Entry["type"],
                metadata: entry.metadata || {},
                pinned: false,
                importance: 0,
                tags: entry.tags || [],
                created_at: new Date().toISOString(),
              } as Entry);
            }
          }

          updateTask(taskId, {
            status: "done",
            entryTitle: entries[0]?.title || file.name,
          });

          // Auto-dismiss done tasks after 5s
          setTimeout(() => dismissTask(taskId), 5000);
        } catch (e: any) {
          updateTask(taskId, { status: "error", error: e?.message || String(e) });
        }
      }
    },
    [updateTask, dismissTask],
  );

  return { tasks, processFiles, dismissTask, dismissAll };
}
