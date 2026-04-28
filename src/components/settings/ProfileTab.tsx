// ─────────────────────────────────────────────────────────────────────────────
// ProfileTab — "About you"
//
// Two stacked panels:
//
//   1. Core (singular fields stored in user_personas)
//      preferred name, full name, pronouns, free-form context, master toggle.
//      Saved via PUT /api/profile.
//
//   2. Living memory (persona-typed entries)
//      Active facts grouped by bucket (identity / family / habit / preference
//      / event), with badges for source and pinned state. Each row has
//      pin / edit / retire actions. A collapsed "Fading" section shows
//      decayed facts the user can rescue. A second collapsed "History"
//      section shows retired facts as a timeline.
//
// All persona facts go through /api/capture and /api/entries — the same
// pipelines that handle every other entry. No new endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, type JSX, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import SettingsRow, { SettingsToggle } from "./SettingsRow";
import { authFetch } from "../../lib/authFetch";
import { useBrain } from "../../context/BrainContext";
import { useBackgroundOps } from "../../hooks/useBackgroundOps";
import { useAdminDevMode } from "../../hooks/useAdminDevMode";
import { useAdminPrefs } from "../../lib/adminPrefs";
import {
  IconBtn,
  Badge,
  SectionTitle,
  Field,
  Label,
  Hint,
  SubHint,
  Loading,
} from "./ProfileTab.bits";

interface ProfileFields {
  full_name: string;
  preferred_name: string;
  pronouns: string;
  context: string;
  enabled: boolean;
}

interface PersonaFact {
  id: string;
  title: string;
  content: string | null;
  tags: string[] | null;
  metadata: {
    bucket?: string;
    status?: "active" | "fading" | "archived" | "rejected";
    source?: string;
    confidence?: number;
    pinned?: boolean;
    last_referenced_at?: string;
    retired_at?: string;
    retired_reason?: string;
    rejected_at?: string;
    rejected_reason?: string;
    derived_from?: string[];
    skip_persona?: boolean;
  } | null;
  created_at: string;
  updated_at: string;
}

const REJECT_REASON_CHIPS = [
  "Just a task I did",
  "About someone else",
  "Work activity, not who I am",
  "One-off event",
  "Not who I am",
];

const EMPTY_CORE: ProfileFields = {
  full_name: "",
  preferred_name: "",
  pronouns: "",
  context: "",
  enabled: true,
};

const CONTEXT_MAX = 4000;

const BUCKET_ORDER = ["identity", "family", "habit", "preference", "event"] as const;
const BUCKET_RENDER_ORDER = [...BUCKET_ORDER, "context"] as const;
const BUCKET_LABELS: Record<string, string> = {
  identity: "Identity",
  family: "Family & people",
  habit: "Habits & routines",
  preference: "Preferences",
  event: "Notable events",
  context: "Other context",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "you",
  chat: "chat",
  capture: "captured",
  import: "imported",
  inference: "inferred",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--surface)",
    color: "var(--ink)",
    border: "1px solid var(--line-soft)",
    borderRadius: 8,
    padding: "10px 12px",
    fontFamily: "var(--f-sans)",
    fontSize: 14,
    outline: "none",
    transition: "border-color 180ms",
  };
}

export default function ProfileTab() {
  const brainCtx = useBrain();
  const brainId = brainCtx?.activeBrain?.id;
  const { isAdmin } = useAdminDevMode();
  const adminPrefs = useAdminPrefs();

  const [core, setCore] = useState<ProfileFields>(EMPTY_CORE);
  const [coreLoaded, setCoreLoaded] = useState(false);
  const [coreSaving, setCoreSaving] = useState(false);
  const [coreSaved, setCoreSaved] = useState(false);
  const [coreError, setCoreError] = useState<string | null>(null);

  const [facts, setFacts] = useState<PersonaFact[]>([]);
  const [factsLoaded, setFactsLoaded] = useState(false);
  const [factsError, setFactsError] = useState<string | null>(null);
  const [showFading, setShowFading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  // Buckets default to collapsed once facts load. Users with 30+ identity
  // facts shouldn't see a wall of cards on tab open — they should see the
  // shape (which buckets exist, how many facts in each) and drill in only
  // when they want detail.
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());
  const [collapseInitialized, setCollapseInitialized] = useState(false);
  const [rejectingFact, setRejectingFact] = useState<PersonaFact | null>(null);

  // Replaces window.confirm() with an in-app branded modal. Same shape as
  // RejectDialog (portal, body-lock, escape, scrim click) — keeps every
  // confirmation in the app feeling like one piece of software, not a
  // surprise drop-back to the browser chrome.
  type ConfirmRequest = {
    title: string;
    body: string | string[];
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  };
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  function toggleBucket(bucket: string) {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

  const [newFactText, setNewFactText] = useState("");
  const [newFactBucket, setNewFactBucket] = useState<(typeof BUCKET_ORDER)[number]>("preference");
  const [adding, setAdding] = useState(false);

  // Long-running operations now live in the global background-ops system —
  // tab-survivable, app-close-survivable, with a global toast. Local state
  // here just mirrors "is my kind currently running?" for button disable.
  const ops = useBackgroundOps();
  const scanning = brainId ? ops.isRunning("persona-scan", brainId) : false;
  const wiping = brainId ? ops.isRunning("persona-wipe", brainId) : false;
  const resetting = brainId ? ops.isRunning("persona-reset", brainId) : false;
  const auditing = brainId ? ops.isRunning("persona-audit", brainId) : false;

  // ── Load core ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch("/api/profile");
        if (!r?.ok) throw new Error("fetch_failed");
        const data = await r.json();
        if (cancelled) return;
        const p = data.profile;
        if (p) {
          setCore({
            full_name: p.full_name || "",
            preferred_name: p.preferred_name || "",
            pronouns: p.pronouns || "",
            context: p.context || "",
            enabled: p.enabled !== false,
          });
        }
      } catch {
        /* empty profile is fine */
      } finally {
        if (!cancelled) setCoreLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load persona facts ────────────────────────────────────────────────────
  async function reloadFacts() {
    if (!brainId) return;
    try {
      const r = await authFetch(
        `/api/entries?brain_id=${encodeURIComponent(brainId)}&type=persona`,
      );
      if (!r?.ok) throw new Error("fetch_failed");
      const data = await r.json();
      const rows: PersonaFact[] = Array.isArray(data) ? data : (data.entries ?? []);
      // Defensive client-side filter — refuses to render anything that isn't
      // explicitly a persona entry. Protects About You from any future
      // regression in the entries endpoint that might leak other types.
      const personaOnly = rows.filter((r: any) => r?.type === "persona");
      setFacts(personaOnly);
      setFactsError(null);
    } catch (e: any) {
      setFactsError(e?.message || "Could not load facts");
    } finally {
      setFactsLoaded(true);
    }
  }
  useEffect(() => {
    reloadFacts(); /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [brainId]);

  // First time facts arrive, collapse every populated bucket — opt-in
  // disclosure feels less overwhelming than a 30-card identity dump.
  // Subsequent reloads (after wipes/audits) leave the user's open/closed
  // choices intact via collapseInitialized.
  useEffect(() => {
    if (!factsLoaded || collapseInitialized) return;
    const allBuckets = new Set<string>();
    for (const f of facts) {
      const b = f.metadata?.bucket;
      if (b && f.metadata?.status !== "rejected" && f.metadata?.status !== "archived") {
        allBuckets.add(String(b));
      }
    }
    setCollapsedBuckets(allBuckets);
    setCollapseInitialized(true);
  }, [factsLoaded, collapseInitialized, facts]);

  // When any of the long-running persona ops transition from running → idle,
  // reload immediately. Without this the UI only reflects the wipe/scan/reset
  // result on a manual refresh — the previous setTimeout(reloadFacts, 1500)
  // approach raced ops that took longer than 1.5s and ran twice for ones
  // that finished sooner.
  const opsActive = scanning || wiping || resetting || auditing;
  useEffect(() => {
    if (!opsActive) {
      reloadFacts();
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [opsActive]);

  // ── Detect first-iteration backfill damage ────────────────────────────────
  // Wrongly-promoted entries have NO derived_from and source not in
  // (manual, chat). If any exist, surface the Reset button.
  const needsReset = useMemo(
    () =>
      facts.some((f) => {
        const m = f.metadata ?? {};
        if (m.derived_from && m.derived_from.length) return false;
        if (m.skip_persona === true) return false;
        const src = String(m.source || "");
        return src !== "manual" && src !== "chat";
      }),
    [facts],
  );

  // ── Detect any auto-extracted facts (have derived_from) ───────────────────
  // Used to gate the Wipe button — no point showing it on a clean brain.
  const hasExtractedFacts = useMemo(
    () =>
      facts.some((f) => {
        const m = f.metadata ?? {};
        if (!m.derived_from || !m.derived_from.length) return false;
        const src = String(m.source || "");
        return src !== "manual" && src !== "chat";
      }),
    [facts],
  );

  // ── Bucket grouping ───────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const out: {
      active: Record<string, PersonaFact[]>;
      fading: PersonaFact[];
      history: PersonaFact[];
      rejected: PersonaFact[];
    } = {
      active: {},
      fading: [],
      history: [],
      rejected: [],
    };
    for (const f of facts) {
      const status = f.metadata?.status || "active";
      if (status === "rejected") {
        out.rejected.push(f);
        continue;
      }
      if (status === "archived") {
        out.history.push(f);
        continue;
      }
      if (status === "fading") {
        out.fading.push(f);
        continue;
      }
      // Only group into a known bucket. Anything missing a bucket goes into
      // a generic "context" group rather than silently inflating preferences.
      const rawBucket = f.metadata?.bucket;
      const bucket = (BUCKET_ORDER as readonly string[]).includes(rawBucket || "")
        ? rawBucket!
        : "context";
      (out.active[bucket] ??= []).push(f);
    }
    // Sort each active bucket: pinned first, then by confidence desc, then by recency.
    for (const bucket of Object.keys(out.active)) {
      out.active[bucket]!.sort((a, b) => {
        const ap = a.metadata?.pinned ? 1 : 0;
        const bp = b.metadata?.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        const ac = a.metadata?.confidence ?? 0.5;
        const bc = b.metadata?.confidence ?? 0.5;
        if (ac !== bc) return bc - ac;
        return (b.updated_at || "").localeCompare(a.updated_at || "");
      });
    }
    out.history.sort((a, b) =>
      (b.metadata?.retired_at || b.updated_at).localeCompare(
        a.metadata?.retired_at || a.updated_at,
      ),
    );
    out.rejected.sort((a, b) =>
      (b.metadata?.rejected_at || b.updated_at).localeCompare(
        a.metadata?.rejected_at || a.updated_at,
      ),
    );
    return out;
  }, [facts]);

  // ── Core save ─────────────────────────────────────────────────────────────
  function patchCore(p: Partial<ProfileFields>) {
    setCore((prev) => ({ ...prev, ...p }));
    setCoreSaved(false);
  }

  async function saveCore() {
    setCoreSaving(true);
    setCoreError(null);
    try {
      const r = await authFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(core),
      });
      if (!r?.ok) throw new Error("save_failed");
      setCoreSaved(true);
      setTimeout(() => setCoreSaved(false), 1800);
    } catch (e: any) {
      setCoreError(e?.message || "Could not save");
    } finally {
      setCoreSaving(false);
    }
  }

  // ── Fact actions (all go through /api/capture or /api/entries) ────────────
  async function addFact() {
    const text = newFactText.trim();
    if (!text || !brainId) return;
    setAdding(true);
    try {
      const r = await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_title: text.slice(0, 200),
          p_content: text,
          p_type: "persona",
          p_brain_id: brainId,
          p_tags: ["persona", newFactBucket],
          p_metadata: {
            bucket: newFactBucket,
            status: "active",
            source: "manual",
            confidence: 1.0,
            pinned: false,
            evidence_count: 1,
            last_referenced_at: new Date().toISOString(),
            // Tell the enrichment classifier to skip — we already know it's persona.
            skip_persona: true,
          },
        }),
      });
      if (!r?.ok) throw new Error("add_failed");
      setNewFactText("");
      await reloadFacts();
    } catch (e: any) {
      setFactsError(e?.message || "Could not add fact");
    } finally {
      setAdding(false);
    }
  }

  function runBackfill() {
    if (!brainId || scanning) return;
    ops.startTask({
      kind: "persona-scan",
      label: "Scanning entries for persona facts",
      resumeKey: brainId,
    });
    // Poll every few seconds to show in-flight extractions as they land.
    // Final reload on completion is handled by the opsActive effect above.
    const poll = setInterval(() => {
      reloadFacts();
    }, 3000);
    setTimeout(() => clearInterval(poll), 5 * 60_000);
  }

  function runReset() {
    if (!brainId || resetting) return;
    setConfirmRequest({
      title: "Undo the previous scan?",
      body: [
        "This restores entries that were wrongly converted into persona cards back to their best-guessed original type — todos return to schedule, events to calendar, and so on.",
        "Manually-added facts and chat-tool facts are not touched.",
      ],
      confirmLabel: "Undo scan",
      onConfirm: () => {
        ops.startTask({
          kind: "persona-reset",
          label: "Reverting previous persona scan",
          resumeKey: brainId,
        });
      },
    });
  }

  function runAudit() {
    if (!brainId || auditing) return;
    setConfirmRequest({
      title: "Audit your living memory?",
      body: [
        "Walks every active fact and bulk-rejects ones that duplicate another fact, match something you already marked as Not me, or are already covered by your About You.",
        "Pinned facts and ones you added manually are never touched. Anything rejected stays in the Not me section so you can restore it if the audit got it wrong.",
      ],
      confirmLabel: "Run audit",
      onConfirm: () => {
        ops.startTask({
          kind: "persona-audit",
          label: "Auditing living memory",
          resumeKey: brainId,
        });
      },
    });
  }

  function runWipe() {
    if (!brainId || wiping) return;
    setConfirmRequest({
      title: "Wipe every auto-extracted fact?",
      body: [
        "Deletes all the facts the scanner produced. Manually-added facts and facts you added via chat are kept.",
        "After wiping, click Run scan again to re-extract with the latest prompt.",
      ],
      confirmLabel: "Wipe facts",
      danger: true,
      onConfirm: () => {
        // Optimistic clear — wipe deletes any active fact whose source is the
        // scanner. Drop those locally NOW so the UI reflects the action; the
        // useEffect above will reconcile against server truth when the op ends.
        setFacts((prev) =>
          prev.filter((f) => {
            const m = f.metadata ?? {};
            const src = String(m.source || "");
            if (src === "manual" || src === "chat") return true;
            if (m.skip_persona === true) return true;
            return false;
          }),
        );
        ops.startTask({
          kind: "persona-wipe",
          label: "Wiping auto-extracted persona facts",
          resumeKey: brainId,
        });
      },
    });
  }

  async function patchFact(id: string, metaPatch: Record<string, unknown>) {
    if (!brainId) return;
    const f = facts.find((x) => x.id === id);
    if (!f) return;
    const newMeta = { ...(f.metadata ?? {}), ...metaPatch };
    // Optimistic: pin/unpin/etc reflects in the UI before the network
    // round-trip. Without this the icon doesn't appear to do anything on
    // a slow connection until the reload returns ~1s later.
    setFacts((prev) => prev.map((x) => (x.id === id ? { ...x, metadata: newMeta } : x)));
    try {
      await authFetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, metadata: newMeta }),
      });
      await reloadFacts();
    } catch {
      /* swallow; reload will reflect server truth */
    }
  }

  async function retireFact(id: string) {
    const f = facts.find((x) => x.id === id);
    if (!f) return;
    if (!brainId) return;

    setConfirmRequest({
      title: "Retire to history?",
      body: [
        `"${f.title}"`,
        'Moves this fact into History — archived but still searchable when chat asks specific questions like "where did I live" or "what was my ex\'s name". Just no longer in your active living memory.',
      ],
      confirmLabel: "Retire",
      onConfirm: async () => {
        try {
          const tags = Array.isArray(f.tags) ? f.tags : [];
          const newTags = tags.includes("history") ? tags : [...tags, "history"];
          const newMeta = {
            ...(f.metadata ?? {}),
            status: "archived" as const,
            retired_at: new Date().toISOString(),
          };
          // Optimistic — flip to archived locally so the row leaves Active
          // immediately. reloadFacts reconciles after server returns.
          setFacts((prev) =>
            prev.map((x) => (x.id === id ? { ...x, tags: newTags, metadata: newMeta } : x)),
          );
          await authFetch("/api/entries", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, tags: newTags, metadata: newMeta }),
          });
          // Open the History section so the user sees where the fact went.
          setShowHistory(true);
          await reloadFacts();
        } catch (e: any) {
          setFactsError(e?.message || "Could not retire");
        }
      },
    });
  }

  async function rejectFact(id: string, reason: string | null) {
    if (!brainId) return;
    const f = facts.find((x) => x.id === id);
    if (!f) return;
    const tags = Array.isArray(f.tags) ? f.tags : [];
    const newTags = tags.includes("rejected") ? tags : [...tags, "rejected"];
    const newMeta = {
      ...(f.metadata ?? {}),
      status: "rejected" as const,
      rejected_at: new Date().toISOString(),
      rejected_reason: reason || undefined,
    };
    // Close dialog + flip the fact to rejected locally NOW. The active list
    // re-groups instantly so the user sees the fact disappear; reload below
    // reconciles against server truth.
    setRejectingFact(null);
    setFacts((prev) =>
      prev.map((x) => (x.id === id ? { ...x, tags: newTags, metadata: newMeta } : x)),
    );
    try {
      await authFetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tags: newTags, metadata: newMeta }),
      });
      await reloadFacts();
    } catch (e: any) {
      setFactsError(e?.message || "Could not mark as not-me");
    }
  }

  async function unrejectFact(id: string) {
    const f = facts.find((x) => x.id === id);
    if (!f) return;
    const tags = (Array.isArray(f.tags) ? f.tags : []).filter((t) => t !== "rejected");
    try {
      await authFetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          tags,
          metadata: {
            ...(f.metadata ?? {}),
            status: "active",
            rejected_at: undefined,
            rejected_reason: undefined,
          },
        }),
      });
      await reloadFacts();
    } catch {
      /* ignore */
    }
  }

  async function deleteFactCompletely(id: string) {
    const f = facts.find((x) => x.id === id);
    if (!f) return;
    setConfirmRequest({
      title: "Permanently delete?",
      body: [`"${f.title}"`, "This removes it from history too — it can't be restored."],
      confirmLabel: "Delete forever",
      danger: true,
      onConfirm: async () => {
        try {
          await authFetch("/api/delete-entry", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          await reloadFacts();
        } catch {
          /* ignore */
        }
      },
    });
  }

  function handleAddKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addFact();
    }
  }

  if (!coreLoaded) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Master toggle */}
      <SettingsRow
        label="Personalise chat with this profile"
        hint="When on, the assistant sees a short ‘about you’ summary on every chat call. Turn off if you want the assistant to forget who you are."
      >
        <SettingsToggle
          value={core.enabled}
          onChange={(v) => {
            patchCore({ enabled: v });
          }}
          ariaLabel="Personalisation toggle"
        />
      </SettingsRow>

      {/* Sensitive-data warning */}
      <div
        style={{
          margin: "10px 0 18px",
          padding: "12px 14px",
          background: "color-mix(in oklch, var(--ember-wash) 70%, var(--surface))",
          border: "1px solid color-mix(in oklch, var(--ember) 24%, var(--line-soft))",
          borderRadius: 10,
        }}
      >
        <p
          className="f-serif"
          style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}
        >
          <strong style={{ fontWeight: 600 }}>
            Never put ID numbers, passport, driver's licence, banking or medical details here.
          </strong>{" "}
          Those go in your encrypted{" "}
          <span style={{ color: "var(--ember)", fontWeight: 600 }}>Vault</span>. This profile is
          plaintext and is sent to the AI on every chat call.
        </p>
      </div>

      {/* Core scalars */}
      <SectionTitle>Core</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Field label="Preferred name / nickname">
          <input
            type="text"
            value={core.preferred_name}
            maxLength={60}
            placeholder="e.g. Chris"
            onChange={(e) => patchCore({ preferred_name: e.target.value })}
            style={inputStyle()}
          />
        </Field>
        <Field label="Full name">
          <input
            type="text"
            value={core.full_name}
            maxLength={120}
            placeholder="e.g. Christian Stander"
            onChange={(e) => patchCore({ full_name: e.target.value })}
            style={inputStyle()}
          />
        </Field>
      </div>

      <Field label="Pronouns">
        <input
          type="text"
          value={core.pronouns}
          maxLength={40}
          placeholder="e.g. he/him"
          onChange={(e) => patchCore({ pronouns: e.target.value })}
          style={{ ...inputStyle(), maxWidth: 240 }}
        />
      </Field>

      <div style={{ marginTop: 14 }}>
        <Label>About you (free-form)</Label>
        <Hint>
          Anything else you want the assistant to keep in mind — your work, projects, where you
          live, things you care about.
        </Hint>
        <textarea
          value={core.context}
          maxLength={CONTEXT_MAX}
          rows={5}
          placeholder="e.g. I run Smash Burger Bar in Pretoria. I'm building EverionMind as a personal second-brain. I prefer concise, direct answers."
          onChange={(e) => patchCore({ context: e.target.value })}
          style={{
            ...inputStyle(),
            resize: "vertical",
            fontFamily: "var(--f-serif)",
            lineHeight: 1.5,
            marginTop: 8,
          }}
        />
        <SubHint>
          {core.context.length} / {CONTEXT_MAX}
        </SubHint>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          onClick={saveCore}
          disabled={coreSaving}
          className="press f-sans"
          style={{
            height: 36,
            padding: "0 18px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            background: "var(--ember)",
            color: "var(--ember-ink)",
            border: 0,
            cursor: coreSaving ? "not-allowed" : "pointer",
            opacity: coreSaving ? 0.6 : 1,
          }}
        >
          {coreSaving ? "Saving…" : "Save core"}
        </button>
        {coreSaved && (
          <span
            className="f-serif"
            style={{ fontSize: 13, fontStyle: "italic", color: "var(--moss)" }}
          >
            saved.
          </span>
        )}
        {coreError && (
          <span
            className="f-serif"
            style={{ fontSize: 13, fontStyle: "italic", color: "var(--blood)" }}
          >
            {coreError}
          </span>
        )}
      </div>

      {/* ── Living memory ─────────────────────────────────────────────────── */}
      <SectionTitle style={{ marginTop: 32 }}>Living memory</SectionTitle>
      <Hint>
        Facts your second brain has learned about you — from chat, captures, and imports. Each one
        is a real entry; pinned facts never decay.
      </Hint>

      {/* Reset — only shown when the first-iteration backfill left junk behind */}
      {needsReset && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "color-mix(in oklch, var(--blood) 8%, var(--surface-low))",
            border: "1px solid color-mix(in oklch, var(--blood) 30%, var(--line-soft))",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              className="f-sans"
              style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
            >
              Undo previous scan
            </p>
            <p
              className="f-serif"
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--ink-faint)",
                lineHeight: 1.45,
              }}
            >
              An earlier version of the scan converted whole entries into persona cards by mistake.
              Reset to put them back into Schedule, Calendar, etc., then run the new scan below.
            </p>
          </div>
          <button
            type="button"
            onClick={runReset}
            disabled={resetting || !brainId}
            className="press f-sans"
            style={{
              height: 34,
              padding: "0 14px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              background: "transparent",
              color: "var(--blood)",
              border: "1px solid color-mix(in oklch, var(--blood) 50%, var(--line-soft))",
              cursor: resetting ? "wait" : "pointer",
              opacity: resetting ? 0.6 : 1,
            }}
          >
            {resetting ? "Reverting…" : "Reset previous scan"}
          </button>
        </div>
      )}

      {/* Audit — re-evaluates active facts against the current prompt rules,
          bulk-rejects ones that duplicate, match a Not-me pattern, or are
          already covered by About-You. Always-visible companion to Wipe. */}
      {hasExtractedFacts && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "var(--surface-low)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              className="f-sans"
              style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
            >
              Audit living memory
            </p>
            <p
              className="f-serif"
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--ink-faint)",
                lineHeight: 1.45,
              }}
            >
              Removes duplicates, facts matching things you marked as Not me, and ones already
              covered by your About You. Pinned and manually-added facts are never touched.
            </p>
          </div>
          <button
            type="button"
            onClick={runAudit}
            disabled={auditing || !brainId}
            className="press f-sans"
            style={{
              height: 34,
              padding: "0 14px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              background: "transparent",
              color: "var(--ember)",
              border: "1px solid color-mix(in oklch, var(--ember) 40%, var(--line-soft))",
              cursor: auditing ? "wait" : "pointer",
              opacity: auditing ? 0.6 : 1,
            }}
          >
            {auditing ? "Auditing…" : "Run audit"}
          </button>
        </div>
      )}

      {/* Wipe — clears auto-extracted facts so you can re-scan with the new prompt */}
      {hasExtractedFacts && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "color-mix(in oklch, var(--ink-faint) 6%, var(--surface-low))",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              className="f-sans"
              style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
            >
              Wipe extracted facts
            </p>
            <p
              className="f-serif"
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--ink-faint)",
                lineHeight: 1.45,
              }}
            >
              Removes everything the scanner has produced so far. Your manually-added facts and
              chat-added facts stay. Use this before re-running the scan after a prompt update.
            </p>
          </div>
          <button
            type="button"
            onClick={runWipe}
            disabled={wiping || !brainId}
            className="press f-sans"
            style={{
              height: 34,
              padding: "0 14px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink-faint)",
              border: "1px solid var(--line-soft)",
              cursor: wiping ? "wait" : "pointer",
              opacity: wiping ? 0.6 : 1,
            }}
          >
            {wiping ? "Wiping…" : "Wipe extracted facts"}
          </button>
        </div>
      )}

      {/* Backfill — scan existing entries and extract short persona facts */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "var(--surface-low)",
          border: "1px dashed var(--line-soft)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <p
            className="f-sans"
            style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
          >
            Scan existing entries
          </p>
          <p
            className="f-serif"
            style={{
              margin: "2px 0 0",
              fontSize: 12,
              fontStyle: "italic",
              color: "var(--ink-faint)",
              lineHeight: 1.45,
            }}
          >
            Look through every note in this brain and extract <em>short facts</em> about you. Each
            fact becomes its own small entry; your originals are never changed. Progress shows in
            the toast — safe to switch tabs or close the app.
          </p>
        </div>
        <button
          type="button"
          onClick={runBackfill}
          disabled={scanning || !brainId}
          className="press f-sans"
          style={{
            height: 34,
            padding: "0 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            background: "transparent",
            color: "var(--ember)",
            border: "1px solid color-mix(in oklch, var(--ember) 40%, var(--line-soft))",
            cursor: scanning ? "wait" : "pointer",
            opacity: scanning ? 0.6 : 1,
          }}
        >
          {scanning ? "Scanning…" : "Run scan"}
        </button>
      </div>

      {/* Manual add */}
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 10,
          display: "flex",
          gap: 8,
        }}
      >
        <select
          value={newFactBucket}
          onChange={(e) => setNewFactBucket(e.target.value as (typeof BUCKET_ORDER)[number])}
          style={{
            ...inputStyle(),
            width: 130,
            padding: "8px 10px",
          }}
        >
          {BUCKET_ORDER.map((b) => (
            <option key={b} value={b}>
              {BUCKET_LABELS[b]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={newFactText}
          onChange={(e) => setNewFactText(e.target.value)}
          onKeyDown={handleAddKey}
          placeholder="A short fact about yourself, third person — e.g. 'Wakes at 5:30 every weekday'"
          maxLength={200}
          style={{ ...inputStyle(), flex: 1 }}
        />
        <button
          type="button"
          onClick={addFact}
          disabled={adding || !newFactText.trim() || !brainId}
          className="press f-sans"
          style={{
            height: 38,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            background: "var(--ember)",
            color: "var(--ember-ink)",
            border: 0,
            cursor: adding ? "not-allowed" : "pointer",
            opacity: adding || !newFactText.trim() ? 0.5 : 1,
          }}
        >
          {adding ? "…" : "Add"}
        </button>
      </div>

      {factsError && (
        <p
          className="f-serif"
          style={{ color: "var(--blood)", fontStyle: "italic", fontSize: 13, marginTop: 8 }}
        >
          {factsError}
        </p>
      )}

      {/* Active facts grouped by bucket — every section uses CollapsibleSection
          so the look + click target stays consistent. */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        {!factsLoaded && <Loading />}

        {factsLoaded &&
          BUCKET_RENDER_ORDER.map((bucket) => {
            const items = grouped.active[bucket] || [];
            if (!items.length) return null;
            const collapsed = collapsedBuckets.has(bucket);
            return (
              <CollapsibleSection
                key={bucket}
                label={BUCKET_LABELS[bucket]}
                count={items.length}
                collapsed={collapsed}
                onToggle={() => toggleBucket(bucket)}
              >
                {items.map((f) => (
                  <FactRow
                    key={f.id}
                    fact={f}
                    onPin={() => patchFact(f.id, { pinned: !f.metadata?.pinned })}
                    onRetire={() => retireFact(f.id)}
                    onReject={() => setRejectingFact(f)}
                    onDelete={() => deleteFactCompletely(f.id)}
                  />
                ))}
              </CollapsibleSection>
            );
          })}

        {factsLoaded &&
          Object.keys(grouped.active).length === 0 &&
          grouped.fading.length === 0 &&
          grouped.history.length === 0 &&
          grouped.rejected.length === 0 && (
            <p
              className="f-serif"
              style={{
                fontStyle: "italic",
                color: "var(--ink-faint)",
                fontSize: 14,
                padding: "16px 0",
              }}
            >
              No facts yet. Add one above, or just have a chat — the assistant will start learning
              who you are.
            </p>
          )}

        {/* Secondary sections — Fading / History / Not me. These always
            render once facts have loaded so users know where rejected
            facts went; empty states say so explicitly. */}
        {factsLoaded && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid var(--line-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {grouped.fading.length > 0 && (
              <CollapsibleSection
                label="Fading"
                count={grouped.fading.length}
                hint="not in chat preamble until reinforced"
                collapsed={!showFading}
                onToggle={() => setShowFading((v) => !v)}
                emphasis="muted"
              >
                {grouped.fading.map((f) => (
                  <FactRow
                    key={f.id}
                    fact={f}
                    onPin={() =>
                      patchFact(f.id, { pinned: true, status: "active", confidence: 1.0 })
                    }
                    onRetire={() => retireFact(f.id)}
                    onReject={() => setRejectingFact(f)}
                    onDelete={() => deleteFactCompletely(f.id)}
                  />
                ))}
              </CollapsibleSection>
            )}

            {/* History — always-visible, mirrors Not me. Empty state tells
                users where retired facts go. */}
            <CollapsibleSection
              label="History"
              count={grouped.history.length}
              hint="life events archived"
              collapsed={!showHistory}
              onToggle={() => setShowHistory((v) => !v)}
              emphasis="muted"
            >
              {grouped.history.length === 0 ? (
                <p
                  className="f-serif"
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontStyle: "italic",
                    color: "var(--ink-faint)",
                    padding: "4px 0",
                  }}
                >
                  Nothing archived yet. When you retire a fact (or it ages out as a one-time event),
                  it lands here — visible but no longer in your active living memory.
                </p>
              ) : (
                grouped.history.map((f) => (
                  <FactRow
                    key={f.id}
                    fact={f}
                    historyMode
                    onPin={() => {}}
                    onRetire={() => {}}
                    onReject={() => {}}
                    onDelete={() => deleteFactCompletely(f.id)}
                  />
                ))
              )}
            </CollapsibleSection>

            {/* Not me — always visible once facts are loaded so users
                know this section exists, even when empty. */}
            <CollapsibleSection
              label="Not me"
              count={grouped.rejected.length}
              hint="won't be re-extracted"
              collapsed={!showRejected}
              onToggle={() => setShowRejected((v) => !v)}
              emphasis="muted"
            >
              {grouped.rejected.length === 0 ? (
                <p
                  className="f-serif"
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontStyle: "italic",
                    color: "var(--ink-faint)",
                    padding: "4px 0",
                  }}
                >
                  Nothing rejected yet. When you mark a fact as Not me, it lands here so future
                  scans skip it — and you can restore it anytime.
                </p>
              ) : (
                grouped.rejected.map((f) => (
                  <FactRow
                    key={f.id}
                    fact={f}
                    rejectedMode
                    onPin={() => {}}
                    onRetire={() => {}}
                    onReject={() => {}}
                    onUnreject={() => unrejectFact(f.id)}
                    onDelete={() => deleteFactCompletely(f.id)}
                  />
                ))
              )}
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Admin-only: live persona-extractor prompt + learnings, gated behind
          a separate adminPref so it stays out of the way unless explicitly
          turned on in the Admin tab. Pinned to the very bottom of Personal
          so it never gets in the way of the actual settings UI. */}
      {isAdmin && adminPrefs.showPersonaPromptDebug && brainId && (
        <PersonaPromptDebug brainId={brainId} factsLength={facts.length} />
      )}

      {rejectingFact && (
        <RejectDialog
          fact={rejectingFact}
          onCancel={() => setRejectingFact(null)}
          onConfirm={(reason) => rejectFact(rejectingFact.id, reason)}
        />
      )}

      {confirmRequest && (
        <ConfirmDialog
          title={confirmRequest.title}
          body={confirmRequest.body}
          confirmLabel={confirmRequest.confirmLabel}
          danger={confirmRequest.danger}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={() => {
            const req = confirmRequest;
            setConfirmRequest(null);
            req.onConfirm();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FactRow({
  fact,
  historyMode,
  rejectedMode,
  onPin,
  onRetire,
  onReject,
  onUnreject,
  onDelete,
}: {
  fact: PersonaFact;
  historyMode?: boolean;
  rejectedMode?: boolean;
  onPin: () => void;
  onRetire: () => void;
  onReject: () => void;
  onUnreject?: () => void;
  onDelete: () => void;
}) {
  const meta = fact.metadata ?? {};
  const pinned = meta.pinned === true;
  const source = (meta.source as string) || "chat";
  const confidence = typeof meta.confidence === "number" ? meta.confidence : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 12px",
        background: pinned
          ? "color-mix(in oklch, var(--ember-wash) 60%, var(--surface))"
          : rejectedMode
            ? "color-mix(in oklch, var(--ink-faint) 4%, var(--surface))"
            : "var(--surface)",
        border: pinned
          ? "1px solid color-mix(in oklch, var(--ember) 25%, var(--line-soft))"
          : "1px solid var(--line-soft)",
        borderRadius: 8,
        opacity: rejectedMode ? 0.7 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="f-sans"
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--ink)",
            lineHeight: 1.5,
            wordBreak: "break-word",
            textDecoration: rejectedMode ? "line-through" : undefined,
          }}
        >
          {pinned && (
            <span title="Pinned" style={{ marginRight: 6 }}>
              📌
            </span>
          )}
          {fact.title}
        </p>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}
        >
          <Badge>{SOURCE_LABELS[source] || source}</Badge>
          {confidence !== null && !historyMode && !rejectedMode && (
            <Badge muted>{Math.round(confidence * 100)}%</Badge>
          )}
          {historyMode && meta.retired_at && (
            <Badge muted>retired {new Date(meta.retired_at).toLocaleDateString("en-ZA")}</Badge>
          )}
          {historyMode && meta.retired_reason && (
            <span
              className="f-serif"
              style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-faint)" }}
            >
              — {meta.retired_reason}
            </span>
          )}
          {rejectedMode && meta.rejected_at && (
            <Badge muted>not me · {new Date(meta.rejected_at).toLocaleDateString("en-ZA")}</Badge>
          )}
          {rejectedMode && meta.rejected_reason && (
            <span
              className="f-serif"
              style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-faint)" }}
            >
              — {meta.rejected_reason}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {!historyMode && !rejectedMode && (
          <>
            <IconBtn label={pinned ? "Unpin" : "Pin"} onClick={onPin}>
              {pinned ? "📍" : "📌"}
            </IconBtn>
            <IconBtn label="Retire to history (no longer true)" onClick={onRetire}>
              ↩
            </IconBtn>
            <IconBtn label="Not me — won't be re-extracted" onClick={onReject}>
              ⊘
            </IconBtn>
          </>
        )}
        {rejectedMode && onUnreject && (
          <IconBtn label="Restore — count this as defining" onClick={onUnreject}>
            ↻
          </IconBtn>
        )}
        {/* Delete is a hard-purge — only useful in history/rejected where the
            fact is already off the chat preamble. On active/fading the user
            should pick Retire (no longer true) or Not me (not who I am);
            neither path needs raw delete. */}
        {(historyMode || rejectedMode) && (
          <IconBtn label="Delete completely" onClick={onDelete} danger>
            ×
          </IconBtn>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RejectDialog — quick chips for the common reasons + freeform fallback. The
// reason is what teaches the extractor; chips just speed up the most common
// cases. The dialog is intentionally lightweight (no portal, no FocusTrap) —
// it's nested inside the settings page which already has its own focus
// management, and Escape exits via the cancel button.
// ─────────────────────────────────────────────────────────────────────────────

function RejectDialog({
  fact,
  onCancel,
  onConfirm,
}: {
  fact: PersonaFact;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Body-lock on open. Without this, iOS Safari anchors the fixed-positioned
  // modal to whatever scroll offset the user was at when they tapped — the
  // dialog ends up far below the fold and you have to scroll to find it.
  // Same trick CaptureSheet/DetailModal use: pin the body at -scrollY, then
  // restore on unmount so the user lands exactly where they were.
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  function pickChip(chip: string) {
    setReason(chip);
  }

  async function confirm() {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim() || null);
    } finally {
      setSubmitting(false);
    }
  }

  // Portal to document.body to escape any transformed ancestor — the
  // settings tab is wrapped in animate-view-enter which applies a
  // transform, and `position: fixed` becomes ancestor-relative (not
  // viewport-relative) once any ancestor has a transform. Without the
  // portal, the dialog ends up far down the page instead of centered.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark fact as not me"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim, rgba(0,0,0,0.4))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          background: "var(--surface-high)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          boxShadow: "var(--lift-3)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <h3
            className="f-serif"
            style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "var(--ink)" }}
          >
            Not me?
          </h3>
          <p
            className="f-serif"
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--ink-faint)",
              lineHeight: 1.5,
            }}
          >
            "{fact.title}"
          </p>
          <p
            className="f-sans"
            style={{
              margin: "10px 0 0",
              fontSize: 12,
              color: "var(--ink-soft)",
              lineHeight: 1.5,
            }}
          >
            Pick a reason. Future scans will skip this fact <em>and others like it</em>. The reason
            teaches the extractor your personal definition of "persona-worthy".
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {REJECT_REASON_CHIPS.map((chip) => {
            const active = reason === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => pickChip(chip)}
                className="press f-sans"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: active ? "var(--ember-wash)" : "transparent",
                  color: active ? "var(--ember)" : "var(--ink-soft)",
                  border: active
                    ? "1px solid color-mix(in oklch, var(--ember) 40%, var(--line-soft))"
                    : "1px solid var(--line-soft)",
                  cursor: "pointer",
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="Or write your own reason…"
          className="f-serif"
          style={{
            width: "100%",
            background: "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            lineHeight: 1.5,
            outline: "none",
            resize: "vertical",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="press f-sans"
            style={{
              height: 36,
              padding: "0 14px",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--line-soft)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="press f-sans"
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              background: "var(--ember)",
              color: "var(--ember-ink)",
              border: 0,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Saving…" : "Mark as not me"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog — branded replacement for window.confirm(). Same portal +
// body-lock pattern as RejectDialog so iOS Safari doesn't anchor the modal
// below the fold and the user lands back on their original scroll position.
// Accepts a single body string OR an array of paragraphs so multi-part
// confirmations read cleanly without inline \n\n hacks.
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string | string[];
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && !submitting) handleConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [submitting]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onCancel();
    } finally {
      setSubmitting(false);
    }
  }

  const paragraphs = Array.isArray(body) ? body : [body];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim, rgba(0,0,0,0.45))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          background: "var(--surface-high)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          boxShadow: "var(--lift-3)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3
          className="f-serif"
          style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "var(--ink)" }}
        >
          {title}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="f-serif"
              style={{
                margin: 0,
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--ink-soft)",
                lineHeight: 1.55,
              }}
            >
              {p}
            </p>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="press f-sans"
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--line-soft)",
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            autoFocus
            className="press f-sans"
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              background: danger ? "var(--blood)" : "var(--ember)",
              color: danger ? "var(--surface-high)" : "var(--ember-ink)",
              border: 0,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CollapsibleSection — single primitive used by every group in Living memory
// (Identity / Family / Habits / Preferences / Notable events / Fading /
// History / Not me). One look, one feel, one click target.
// ─────────────────────────────────────────────────────────────────────────────

function CollapsibleSection({
  label,
  count,
  hint,
  collapsed,
  onToggle,
  children,
  emphasis = "normal",
}: {
  label: string;
  count: number;
  hint?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  emphasis?: "normal" | "muted";
}) {
  const muted = emphasis === "muted";
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "8px 4px",
          background: "transparent",
          border: 0,
          borderBottom: "1px solid transparent",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 140ms ease, border-color 140ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--surface-low)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            color: "var(--ink-faint)",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(.16,1,.3,1)",
            flexShrink: 0,
          }}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          className="f-serif"
          style={{
            fontSize: muted ? 13 : 15,
            fontWeight: 500,
            color: muted ? "var(--ink-soft)" : "var(--ink)",
            fontStyle: muted ? "italic" : "normal",
          }}
        >
          {label}
        </span>
        <span
          className="f-sans"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-faint)",
            background: "var(--surface-low)",
            border: "1px solid var(--line-soft)",
            borderRadius: 999,
            padding: "1px 8px",
            minWidth: 22,
            textAlign: "center",
          }}
        >
          {count}
        </span>
        {hint && !collapsed && (
          <span
            className="f-sans"
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--ink-faint)",
              fontStyle: "italic",
            }}
          >
            {hint}
          </span>
        )}
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: collapsed ? 0 : 9999,
          opacity: collapsed ? 0 : 1,
          transition: "opacity 200ms ease",
          marginTop: collapsed ? 0 : 8,
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 24 }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PersonaPromptDebug — live extractor prompt + learnings panel.
//
// Calls GET /api/entries?action=persona-prompt&brain_id=… (admin-only on the
// server) and renders the fully-rendered prompt that would be sent to Gemini
// for THIS user, alongside the structured context the prompt was built from
// (name / About You / confirmed facts / rejected patterns). Auto-refreshes
// when facts change so the admin can watch learnings update in real time.
// ─────────────────────────────────────────────────────────────────────────────

interface PersonaPromptPayload {
  context: {
    userName: string;
    fullName: string;
    pronouns: string;
    coreContext: string;
    confirmedFacts: string[];
    rejectedFacts: Array<{ title: string; reason: string | null }>;
  };
  prompt: string;
}

function PersonaPromptDebug({
  brainId,
  factsLength,
}: {
  brainId: string;
  factsLength: number;
}): JSX.Element {
  const [data, setData] = useState<PersonaPromptPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await authFetch(
        `/api/entries?action=persona-prompt&brain_id=${encodeURIComponent(brainId)}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as PersonaPromptPayload;
      setData(json);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when expanded; auto-refresh whenever facts change so the
  // panel always shows current learnings.
  useEffect(() => {
    if (!collapsed) load(); /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [collapsed, brainId, factsLength]);

  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 18,
        borderTop: "1px dashed var(--line)",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "8px 4px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            width: 14,
            height: 14,
            color: "var(--ember)",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          className="f-mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ember)",
          }}
        >
          Admin · live persona prompt
        </span>
        <span
          className="f-sans"
          style={{ fontSize: 11, color: "var(--ink-faint)", fontStyle: "italic" }}
        >
          watch the extractor learn
        </span>
      </button>

      {!collapsed && (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            background: "var(--surface-low)",
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {loading && !data && (
            <p className="f-mono" style={{ margin: 0, fontSize: 12, color: "var(--ink-faint)" }}>
              loading prompt…
            </p>
          )}
          {err && (
            <p className="f-mono" style={{ margin: 0, fontSize: 12, color: "var(--blood)" }}>
              error: {err}
            </p>
          )}

          {data && (
            <>
              <DebugBlock
                label="Identity"
                value={`${data.context.userName || "(no preferred name)"}${
                  data.context.fullName && data.context.fullName !== data.context.userName
                    ? `  ·  ${data.context.fullName}`
                    : ""
                }${data.context.pronouns ? `  ·  ${data.context.pronouns}` : ""}`}
              />

              <DebugBlock
                label="Core profile (About You)"
                value={data.context.coreContext || "(empty)"}
                multiline
              />

              <DebugList
                label={`Confirmed facts the model already knows (${data.context.confirmedFacts.length})`}
                items={data.context.confirmedFacts}
                emptyText="None yet — facts confirmed via chat or pinned will appear here."
              />

              <DebugRejectedList
                label={`Rejected patterns the model now skips (${data.context.rejectedFacts.length})`}
                items={data.context.rejectedFacts}
                emptyText="Nothing rejected yet. Mark facts as Not me and they appear here — the next scan will skip anything similar."
              />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="press f-sans"
                  style={{
                    height: 30,
                    padding: "0 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    background: "transparent",
                    color: showRaw ? "var(--ember)" : "var(--ink-soft)",
                    border: `1px solid ${showRaw ? "var(--ember)" : "var(--line-soft)"}`,
                    cursor: "pointer",
                  }}
                >
                  {showRaw ? "Hide raw prompt" : "Show raw prompt"}
                </button>
                <button
                  type="button"
                  onClick={() => load()}
                  disabled={loading}
                  className="press f-sans"
                  style={{
                    height: 30,
                    padding: "0 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    background: "transparent",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--line-soft)",
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
                <span
                  className="f-sans"
                  style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: "auto" }}
                >
                  {data.prompt.length.toLocaleString()} chars
                </span>
              </div>

              {showRaw && (
                <pre
                  className="f-mono"
                  style={{
                    margin: 0,
                    padding: 12,
                    background: "var(--surface)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "var(--ink-soft)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 480,
                    overflowY: "auto",
                    lineHeight: 1.55,
                  }}
                >
                  {data.prompt}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DebugBlock({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}): JSX.Element {
  return (
    <div>
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="f-mono"
        style={{
          fontSize: 12,
          color: "var(--ink)",
          whiteSpace: multiline ? "pre-wrap" : "normal",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DebugList({
  label,
  items,
  emptyText,
}: {
  label: string;
  items: string[];
  emptyText: string;
}): JSX.Element {
  return (
    <div>
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {items.length === 0 ? (
        <div
          className="f-serif"
          style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-faint)" }}
        >
          {emptyText}
        </div>
      ) : (
        <ul
          style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}
        >
          {items.map((it, i) => (
            <li
              key={i}
              className="f-mono"
              style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DebugRejectedList({
  label,
  items,
  emptyText,
}: {
  label: string;
  items: Array<{ title: string; reason: string | null }>;
  emptyText: string;
}): JSX.Element {
  return (
    <div>
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {items.length === 0 ? (
        <div
          className="f-serif"
          style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-faint)" }}
        >
          {emptyText}
        </div>
      ) : (
        <ul
          style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}
        >
          {items.map((it, i) => (
            <li
              key={i}
              className="f-mono"
              style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}
            >
              {it.title}
              {it.reason && (
                <span style={{ color: "var(--ink-faint)", fontStyle: "italic" }}>
                  {"  —  "}
                  {it.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
