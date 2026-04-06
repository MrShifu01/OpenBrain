import { useState, type JSX } from "react";
import { authFetch } from "../lib/authFetch";
import type { Brain } from "../types";

/**
 * CreateBrainModal — create a shared brain + optionally invite members by email.
 */

interface BrainTypeOption {
  value: string;
  label: string;
  emoji: string;
  desc: string;
}

const BRAIN_TYPES: BrainTypeOption[] = [
  {
    value: "family",
    label: "Family",
    emoji: "🏠",
    desc: "For household, kids, shared finances, emergencies",
  },
  {
    value: "business",
    label: "Business",
    emoji: "🏪",
    desc: "For staff, suppliers, SOPs, costs, licences",
  },
];

interface PendingInvite {
  email: string;
  role: string;
}

interface CreateBrainModalProps {
  onClose: () => void;
  onCreate: (brain: Brain, brainType: string) => Promise<void>;
}

export default function CreateBrainModal({
  onClose,
  onCreate,
}: CreateBrainModalProps): JSX.Element {
  const [name, setName] = useState<string>("");
  const [brainType, setBrainType] = useState<string>("family");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function addInvite(): void {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || pendingInvites.some((i) => i.email === email)) return;
    setPendingInvites((prev) => [...prev, { email, role: inviteRole }]);
    setInviteEmail("");
  }

  function removeInvite(email: string): void {
    setPendingInvites((prev) => prev.filter((i) => i.email !== email));
  }

  async function handleCreate(): Promise<void> {
    if (!name.trim()) {
      setError("Please enter a brain name");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Create the brain
      const res = await authFetch("/api/brains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type: brainType }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create brain");
      }
      const brain = await res.json();

      // Send invites
      for (const invite of pendingInvites) {
        await authFetch("/api/brains?action=invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brain_id: brain.id, email: invite.email, role: invite.role }),
        }).catch((err) => console.error("[CreateBrainModal:invite] Failed to send invite", err)); // Non-fatal
      }

      await onCreate(brain, brainType);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[90vw] rounded-[14px] border border-white/[0.12] bg-[#1a1a2e] p-7 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
      >
        <h3 className="m-0 mb-[18px] text-[17px] font-semibold text-[#e8e8e8]">
          Create shared brain
        </h3>

        {/* Brain type selector */}
        <label className="mb-1.5 block text-xs font-medium tracking-[0.5px] text-[#888] uppercase">
          Brain type
        </label>
        <div className="mb-4 flex gap-2">
          {BRAIN_TYPES.map((bt) => (
            <button
              key={bt.value}
              type="button"
              onClick={() => setBrainType(bt.value)}
              className={`flex-1 cursor-pointer rounded-lg px-3 py-2.5 text-left ${
                brainType === bt.value
                  ? "border border-[rgba(124,143,240,0.5)] bg-[rgba(124,143,240,0.2)]"
                  : "border border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="mb-0.5 text-lg">{bt.emoji}</div>
              <div
                className={`text-[13px] font-semibold ${brainType === bt.value ? "text-[#a5b4fc]" : "text-[#d4d4d8]"}`}
              >
                {bt.label}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-[#666]">{bt.desc}</div>
            </button>
          ))}
        </div>

        {/* Brain name */}
        <label className="mb-1.5 block text-xs font-medium tracking-[0.5px] text-[#888] uppercase">
          Brain name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder='e.g. "Stander Family" or "Smash Burger Bar"'
          className="mb-1 box-border w-full rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-[9px] text-sm text-[#e8e8e8] outline-none"
        />

        {/* Invite members */}
        <label className="mt-4 mb-1.5 block text-xs font-medium tracking-[0.5px] text-[#888] uppercase">
          Invite members (optional)
        </label>
        <div className="flex gap-1.5">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInvite()}
            placeholder="email@example.com"
            className="box-border w-full flex-1 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-[9px] text-sm text-[#e8e8e8] outline-none"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="box-border w-[90px] shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-[9px] text-sm text-[#e8e8e8] outline-none"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={addInvite}
            className="shrink-0 cursor-pointer rounded-lg border border-[rgba(124,143,240,0.3)] bg-[rgba(124,143,240,0.15)] px-3.5 py-[9px] text-[13px] whitespace-nowrap text-[#a5b4fc]"
          >
            Add
          </button>
        </div>

        {/* Pending invites list */}
        {pendingInvites.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {pendingInvites.map((inv) => (
              <div
                key={inv.email}
                className="flex items-center justify-between rounded-[7px] bg-white/5 px-2.5 py-1.5 text-[13px]"
              >
                <span className="text-[#d4d4d8]">{inv.email}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-[#888]">{inv.role}</span>
                  <button
                    onClick={() => removeInvite(inv.email)}
                    className="cursor-pointer border-none bg-none text-sm text-[#f87171]"
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2.5 text-[11px] leading-normal text-[#666]">
          <b className="text-[#888]">Member</b> — can view, add, and edit entries.
          <br />
          <b className="text-[#888]">Viewer</b> — read-only access.
        </div>

        {error && <div className="mt-3 text-[13px] text-[#f87171]">{error}</div>}

        {/* Actions */}
        <div className="mt-[22px] flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-white/[0.12] bg-white/[0.06] px-[18px] py-[9px] text-sm text-[#aaa]"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="cursor-pointer rounded-lg border border-[rgba(124,143,240,0.4)] bg-[rgba(124,143,240,0.25)] px-5 py-[9px] text-sm font-semibold text-[#c7d2fe]"
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating…" : "Create brain"}
          </button>
        </div>
      </div>
    </div>
  );
}
