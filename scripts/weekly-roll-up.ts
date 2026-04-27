/**
 * Weekly roll-up — composes one Monday-morning email aggregating five tools
 * so I see the whole picture in one inbox instead of five dashboards.
 *
 * Runs from .github/workflows/weekly-roll-up.yml on `cron: 0 6 * * 1` (Mon 06:00 UTC).
 * Also runnable on demand via `workflow_dispatch`.
 *
 * Each section degrades gracefully when its API token is missing — the
 * email gets a "secret not configured" line for that section instead of
 * the whole job crashing. Lets you turn integrations on incrementally.
 *
 * Required secrets (add in repo Settings → Secrets and variables → Actions):
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 *   POSTHOG_API_KEY, POSTHOG_PROJECT_ID
 *   VERCEL_TOKEN, VERCEL_PROJECT_ID
 *   RESEND_API_KEY, WEEKLY_REPORT_TO
 * (GITHUB_TOKEN is auto-injected by Actions for e2e + Lighthouse pulls.)
 *
 * First run: set DRY_RUN=1 to log the email body to stdout instead of
 * sending. Flip to live once the format looks right.
 */

const env = process.env;
const SINCE_HOURS = 24 * 7;
const since = new Date(Date.now() - SINCE_HOURS * 60 * 60 * 1000);
const sinceISO = since.toISOString();

interface Section {
  title: string;
  rows: Array<[string, string]>;
  note?: string;
}

async function safeFetchJson(url: string, init: RequestInit, label: string): Promise<any> {
  try {
    const r = await fetch(url, init);
    if (!r.ok) {
      console.warn(`[${label}] HTTP ${r.status}`);
      return { _error: `HTTP ${r.status}` };
    }
    return await r.json();
  } catch (err: any) {
    console.warn(`[${label}] ${err.message}`);
    return { _error: err.message };
  }
}

async function sentrySection(): Promise<Section> {
  const token = env.SENTRY_AUTH_TOKEN;
  const org = env.SENTRY_ORG;
  const project = env.SENTRY_PROJECT;
  if (!token || !org || !project) {
    return { title: "Sentry", rows: [], note: "secrets not configured" };
  }
  const headers = { Authorization: `Bearer ${token}` };
  const stats = await safeFetchJson(
    `https://sentry.io/api/0/organizations/${org}/stats_v2/?project=${project}&category=error&statsPeriod=7d&interval=7d&field=sum(quantity)`,
    { headers },
    "sentry-stats",
  );
  const issues = await safeFetchJson(
    `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=7d&query=is:unresolved&limit=5`,
    { headers },
    "sentry-issues",
  );
  const eventCount = stats?.groups?.[0]?.totals?.["sum(quantity)"] ?? 0;
  const issueCount = Array.isArray(issues) ? issues.length : 0;
  return {
    title: "Sentry",
    rows: [
      ["Errors (7d)", String(eventCount)],
      ["Open issues", String(issueCount)],
      ...(Array.isArray(issues)
        ? issues
            .slice(0, 3)
            .map((i: any): [string, string] => [
              "·",
              `${i.title?.slice(0, 60) ?? "(no title)"} — ${i.count}× last seen ${i.lastSeen?.slice(0, 10) ?? "?"}`,
            ])
        : []),
    ],
  };
}

async function posthogSection(): Promise<Section> {
  const key = env.POSTHOG_API_KEY;
  const projectId = env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) {
    return { title: "PostHog", rows: [], note: "secrets not configured" };
  }
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  // DAU = unique distinct_id over the last 7 days
  const dauQuery = {
    query: {
      kind: "HogQLQuery",
      query: `SELECT count(DISTINCT distinct_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY`,
    },
  };
  const dauRes = await safeFetchJson(
    `https://eu.i.posthog.com/api/projects/${projectId}/query/`,
    { method: "POST", headers, body: JSON.stringify(dauQuery) },
    "posthog-dau",
  );
  const dau = dauRes?.results?.[0]?.[0] ?? "?";
  // Captures = autocapture events filtered by element selector (best-effort)
  const captureQuery = {
    query: {
      kind: "HogQLQuery",
      query: `SELECT count() FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY`,
    },
  };
  const capRes = await safeFetchJson(
    `https://eu.i.posthog.com/api/projects/${projectId}/query/`,
    { method: "POST", headers, body: JSON.stringify(captureQuery) },
    "posthog-pv",
  );
  const pageviews = capRes?.results?.[0]?.[0] ?? "?";
  return {
    title: "PostHog",
    rows: [
      ["WAU (unique users)", String(dau)],
      ["Pageviews (7d)", String(pageviews)],
    ],
  };
}

async function vercelSection(): Promise<Section> {
  const token = env.VERCEL_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    return { title: "Vercel", rows: [], note: "secrets not configured" };
  }
  const headers = { Authorization: `Bearer ${token}` };
  // Vercel Analytics REST API: /v1/projects/{id}/analytics/overview?from=&to=
  const from = since.getTime();
  const to = Date.now();
  const overview = await safeFetchJson(
    `https://api.vercel.com/v1/projects/${projectId}/analytics/overview?from=${from}&to=${to}`,
    { headers },
    "vercel-overview",
  );
  const pv = overview?.metrics?.pageviews?.value ?? overview?.pageviews ?? "?";
  return {
    title: "Vercel",
    rows: [["Pageviews (7d)", String(pv)]],
  };
}

async function lighthouseSection(): Promise<Section> {
  const ghToken = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY; // owner/name
  if (!ghToken || !repo)
    return { title: "Lighthouse", rows: [], note: "GitHub context unavailable" };
  const headers = { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" };
  const runs = await safeFetchJson(
    `https://api.github.com/repos/${repo}/actions/workflows/lighthouse.yml/runs?status=success&per_page=1`,
    { headers },
    "lh-runs",
  );
  const lastRun = runs?.workflow_runs?.[0];
  if (!lastRun) return { title: "Lighthouse", rows: [], note: "no successful runs yet" };
  return {
    title: "Lighthouse",
    rows: [
      ["Last successful run", lastRun.created_at?.slice(0, 10) ?? "?"],
      ["Run URL", lastRun.html_url],
    ],
  };
}

async function e2eSection(): Promise<Section> {
  const ghToken = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  if (!ghToken || !repo) return { title: "E2E", rows: [], note: "GitHub context unavailable" };
  const headers = { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" };
  const runs = await safeFetchJson(
    `https://api.github.com/repos/${repo}/actions/workflows/e2e.yml/runs?per_page=20`,
    { headers },
    "e2e-runs",
  );
  const recent = (runs?.workflow_runs ?? []).filter((r: any) => new Date(r.created_at) > since);
  const total = recent.length;
  const passed = recent.filter((r: any) => r.conclusion === "success").length;
  const passRate = total ? Math.round((passed / total) * 100) : 0;
  return {
    title: "E2E",
    rows: [
      ["Runs (7d)", String(total)],
      ["Pass rate", `${passRate}%`],
    ],
  };
}

function renderHtml(sections: Section[]): { subject: string; html: string } {
  const sentry = sections.find((s) => s.title === "Sentry");
  const posthog = sections.find((s) => s.title === "PostHog");
  const e2e = sections.find((s) => s.title === "E2E");
  const lh = sections.find((s) => s.title === "Lighthouse");

  const errorCount = sentry?.rows.find(([k]) => k === "Errors (7d)")?.[1] ?? "?";
  const wau = posthog?.rows.find(([k]) => k === "WAU (unique users)")?.[1] ?? "?";
  const e2eRate = e2e?.rows.find(([k]) => k === "Pass rate")?.[1] ?? "?";
  const lhDate = lh?.rows.find(([k]) => k === "Last successful run")?.[1] ?? "?";

  const subject = `Everion weekly — ${errorCount} errors · ${wau} WAU · e2e ${e2eRate} · LH ${lhDate}`;

  const sectionHtml = sections
    .map(
      (s) => `
    <h3 style="font-family: -apple-system, system-ui, sans-serif; margin: 24px 0 8px; color: #2D2926;">${s.title}</h3>
    ${
      s.note
        ? `<p style="color:#888; font-size:13px; margin:0;">${s.note}</p>`
        : `<table style="font-family: -apple-system, system-ui, sans-serif; font-size:14px; border-collapse:collapse;">
            ${s.rows.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0; color:#666;">${k}</td><td style="padding:2px 0; color:#2D2926;">${v}</td></tr>`).join("")}
          </table>`
    }
  `,
    )
    .join("");

  const html = `
<!doctype html>
<html><body style="background:#fff; padding:24px;">
  <div style="max-width:560px; margin:0 auto;">
    <p style="color:#888; font-size:12px; margin:0 0 16px; text-transform:uppercase; letter-spacing:0.05em;">Week ending ${new Date().toISOString().slice(0, 10)}</p>
    <h1 style="font-family: Georgia, serif; font-size:28px; color:#2D2926; margin:0 0 4px;">Everion weekly</h1>
    <p style="color:#666; font-style:italic;">${subject.replace("Everion weekly — ", "")}</p>
    ${sectionHtml}
  </div>
</body></html>`;
  return { subject, html };
}

async function send(subject: string, html: string): Promise<void> {
  if (env.DRY_RUN === "1") {
    console.log("[DRY_RUN] subject:", subject);
    console.log("[DRY_RUN] body:\n", html);
    return;
  }
  const apiKey = env.RESEND_API_KEY;
  const to = env.WEEKLY_REPORT_TO;
  if (!apiKey || !to) {
    throw new Error("RESEND_API_KEY or WEEKLY_REPORT_TO missing — required for live send");
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Everion <noreply@everion.smashburgerbar.co.za>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!r.ok) throw new Error(`Resend HTTP ${r.status}: ${await r.text()}`);
  console.log("sent");
}

async function main() {
  console.log(`weekly roll-up since ${sinceISO}`);
  const sections = await Promise.all([
    sentrySection(),
    posthogSection(),
    vercelSection(),
    lighthouseSection(),
    e2eSection(),
  ]);
  const { subject, html } = renderHtml(sections);
  await send(subject, html);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
