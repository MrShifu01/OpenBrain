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
    <div onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <h3>Create shared brain</h3>

        {/* Brain type selector */}
        <label>Brain type</label>
        <div>
          {BRAIN_TYPES.map((bt) => (
            <button
              key={bt.value}
              type="button"
              onClick={() => setBrainType(bt.value)}
            >
              <div>{bt.emoji}</div>
              <div>{bt.label}</div>
              <div>{bt.desc}</div>
            </button>
          ))}
        </div>

        {/* Brain name */}
        <label>Brain name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder='e.g. "Stander Family" or "Smash Burger Bar"'
        />

        {/* Invite members */}
        <label>Invite members (optional)</label>
        <div>
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInvite()}
            placeholder="email@example.com"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button onClick={addInvite}>
            Add
          </button>
        </div>

        {/* Pending invites list */}
        {pendingInvites.length > 0 && (
          <div>
            {pendingInvites.map((inv) => (
              <div key={inv.email}>
                <span>{inv.email}</span>
                <span>
                  <span>{inv.role}</span>
                  <button onClick={() => removeInvite(inv.email)}>×</button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div>
          <b>Member</b> — can view, add, and edit entries.
          <br />
          <b>Viewer</b> — read-only access.
        </div>

        {error && <div>{error}</div>}

        {/* Actions */}
        <div>
          <button onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating…" : "Create brain"}
          </button>
        </div>
      </div>
    </div>
  );
}
