// Tiny Resend wrapper. Lazy-checks the API key so missing config returns
// `{ ok: false, error: "not_configured" }` rather than throwing at module
// load — invite send remains a best-effort notification on top of the
// link returned by the API (the owner can copy/share it manually).

interface SendInviteEmailArgs {
  to: string;
  brainName: string;
  inviterName: string;
  acceptUrl: string;
  role: "viewer" | "member";
}

export async function sendInviteEmail(
  args: SendInviteEmailArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RESEND_FROM || "").trim() || "Everion <noreply@everionmind.com>";
  if (!apiKey) return { ok: false, error: "not_configured" };

  const subject = `${args.inviterName} invited you to "${args.brainName}" on Everion Mind`;
  const roleLine =
    args.role === "viewer"
      ? "You'll be able to read entries and chat with the brain."
      : "You'll be able to read, capture, and chat with the brain.";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;font-weight:600;">You've been invited to a brain</h2>
      <p style="margin:0 0 8px;line-height:1.5;">
        <strong>${escapeHtml(args.inviterName)}</strong> invited you to join
        <strong>${escapeHtml(args.brainName)}</strong> as a <em>${args.role}</em>.
      </p>
      <p style="margin:0 0 24px;line-height:1.5;color:#666;">${roleLine}</p>
      <a href="${escapeAttr(args.acceptUrl)}"
         style="display:inline-block;background:#c45a3a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">
         Accept invite
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.4;">
        Or open this link: <a href="${escapeAttr(args.acceptUrl)}">${escapeHtml(args.acceptUrl)}</a><br />
        Invites expire in 7 days. If you weren't expecting this, you can ignore this email.
      </p>
    </div>
  `.trim();

  const text =
    `${args.inviterName} invited you to join "${args.brainName}" on Everion Mind as a ${args.role}.\n\n` +
    `Accept the invite: ${args.acceptUrl}\n\n` +
    `Invites expire in 7 days.`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: args.to, subject, html, text }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return { ok: false, error: `resend_${r.status}: ${detail.slice(0, 200)}` };
    }
    const data = (await r.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
