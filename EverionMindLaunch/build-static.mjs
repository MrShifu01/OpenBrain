#!/usr/bin/env node
// Build a static, read-only copy of the launch dashboard so it can be
// deployed to Vercel and viewed on mobile. Mirrors what server.mjs
// does at runtime — same DOCS list, same auto-discovery — but bakes
// the manifest + every markdown file into a `dist/` folder.
//
// Differences from the local server:
//   - Read-only. The /toggle POST is replaced with an in-page toast
//     telling the user to edit locally. Editing on mobile is intentionally
//     out of scope (no auth, no concurrency control).
//   - /docs becomes /docs.json (Vercel doesn't serve no-extension files
//     with the right content-type by default; vercel.json rewrites
//     /docs → /docs.json so the existing fetch works unchanged).
//   - Markdown files are copied flat into dist/docs/<path> so the same
//     /docs/<path> URL pattern keeps working on the deployed site.

import { readdir, readFile, writeFile, mkdir, stat, rm, copyFile } from "node:fs/promises";
import { dirname, resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = resolve(ROOT, "dist");

// Curated docs list — kept in lock-step with server.mjs's DOCS const.
// If you add a new top-level doc to server.mjs, mirror it here. Files
// in AUTO_GROUPS dirs (below) get picked up automatically.
const DOCS = [
  { id: "playbook",     file: "PLAYBOOK.md",         title: "Playbook (start here)", role: "doc" },
  { id: "checklist",    file: "LAUNCH_CHECKLIST.md", title: "Checklist",    role: "checklist" },
  { id: "roadmap",      file: "ROADMAP.md",          title: "Roadmap",      role: "doc" },
  { id: "strategy",     file: "STRATEGY.md",         title: "Strategy",     role: "doc" },
  { id: "research",     file: "RESEARCH.md",         title: "Research",     role: "doc" },
  { id: "brainstorm",   file: "BRAINSTORM.md",       title: "Brainstorm",   role: "doc" },
  { id: "arch-index",       file: "architecture/INDEX.md",            title: "Architecture",        role: "doc",  group: "architecture" },
  { id: "arch-auth",        file: "architecture/auth.md",             title: "Auth",                role: "doc",  group: "architecture" },
  { id: "arch-bell",        file: "architecture/bell.md",             title: "Notification Bell",   role: "doc",  group: "architecture" },
  { id: "arch-capture",     file: "architecture/capture.md",          title: "Capture pipeline",    role: "doc",  group: "architecture" },
  { id: "arch-cron",        file: "architecture/cron.md",             title: "Cron + workflows",    role: "doc",  group: "architecture" },
  { id: "arch-enrich",      file: "architecture/enrich.md",           title: "Enrichment pipeline", role: "doc",  group: "architecture" },
  { id: "arch-gmail",       file: "architecture/gmail.md",            title: "Gmail sync",          role: "doc",  group: "architecture" },
  { id: "arch-events",      file: "architecture/events.md",           title: "PostHog events",      role: "doc",  group: "architecture" },
  { id: "arch-security",    file: "architecture/security.md",         title: "Security",            role: "doc",  group: "architecture" },
  { id: "arch-onboarding",  file: "architecture/onboarding-flow.md",  title: "Onboarding flow",     role: "doc",  group: "architecture" },
];

const AUTO_GROUPS = [
  { dir: "Working",         group: "working",          sort: "mtime-desc" },
  { dir: "Working/archive", group: "working-archive",  sort: "mtime-desc" },
  { dir: "Audits",          group: "audits",           sort: "mtime-desc" },
  { dir: "Audits/archive",  group: "audits-archive",   sort: "mtime-desc" },
  // Top-level marketing/*.md (playbooks, cross-channel strategy). The file
  // filter inside discoverAutoDocs excludes subdirectories, so ProductHunt/
  // entries don't double-count in this group.
  { dir: "marketing",             group: "marketing-playbooks",   sort: "mtime-desc" },
  { dir: "marketing/ProductHunt", group: "marketing-producthunt", sort: "name-asc" },
  { dir: "Roadmap",         group: "roadmap",          sort: "name-asc" },
  { dir: "Specs",           group: "specs",            sort: "mtime-desc" },
  { dir: "Specs/archive",   group: "specs-archive",    sort: "mtime-desc" },
  { dir: "Ops",             group: "ops",              sort: "name-asc" },
  { dir: "Legal",           group: "legal",            sort: "name-asc" },
  { dir: "Support",         group: "support",          sort: "name-asc" },
  { dir: "Brand",           group: "brand",            sort: "name-asc" },
  { dir: "Mobile",          group: "mobile",           sort: "name-asc" },
  { dir: "Analytics",       group: "analytics",        sort: "name-asc" },
];

async function readFirstH1(absPath) {
  try {
    const content = await readFile(absPath, "utf8");
    const head = content.split(/\r?\n/, 40);
    for (const line of head) {
      const m = /^#\s+(.+?)\s*$/.exec(line);
      if (m) return m[1].trim();
    }
  } catch { /* unreadable */ }
  return null;
}

function fallbackTitleFromFile(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/^(\d{4}-\d{2}-\d{2})[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function discoverAutoDocs() {
  const out = [];
  for (const group of AUTO_GROUPS) {
    const absDir = resolve(ROOT, group.dir);
    let entries = [];
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch { continue; }
    const groupOut = [];
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
      const file = `${group.dir}/${ent.name}`.split(sep).join("/");
      const abs = resolve(ROOT, file);
      const st = await stat(abs);
      const h1 = await readFirstH1(abs);
      const title = h1 || fallbackTitleFromFile(ent.name);
      const id = `${group.group}-${ent.name.replace(/\.md$/i, "")}`;
      groupOut.push({ id, file, title, role: "doc", group: group.group, mtime: st.mtimeMs, bytes: st.size });
    }
    if (group.sort === "mtime-desc") groupOut.sort((a, b) => b.mtime - a.mtime);
    else if (group.sort === "name-asc") groupOut.sort((a, b) => a.file.localeCompare(b.file));
    out.push(...groupOut);
  }
  return out;
}

async function listDocs() {
  const out = [];
  const seen = new Set();
  for (const doc of DOCS) {
    try {
      const st = await stat(resolve(ROOT, doc.file));
      out.push({ ...doc, mtime: st.mtimeMs, bytes: st.size });
      seen.add(doc.file);
    } catch { /* missing */ }
  }
  const auto = await discoverAutoDocs();
  for (const d of auto) {
    if (seen.has(d.file)) continue;
    out.push(d);
  }
  return out;
}

async function copyMarkdown(rel) {
  const src = resolve(ROOT, rel);
  const dst = resolve(DIST, "docs", rel);
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
}

// Patch the runtime HTML so a deployed page does not pretend it can
// write back. We replace the toggle handler body with a "read-only"
// toast and add a small banner at the top. Everything else (fetching
// /docs, /docs/<path>) keeps working unchanged because the static
// folder is laid out the same way the local server serves.
function patchHtml(html) {
  const banner = `
    <div id="readOnlyBanner" style="
      padding: 8px 14px; font-size: 12px; font-family: var(--font-sans, system-ui);
      background: var(--ember-wash, #fdf3e7); color: var(--ember, #b06b1a);
      border-bottom: 1px solid var(--line-soft, #e7d8c5);
      text-align: center;
    ">📱 read-only mobile view — edit locally to make changes</div>
  `;
  let out = html.replace(/<body([^>]*)>/, `<body$1>${banner}`);

  // Swap the toggle implementation. We can't call a server endpoint
  // here, so we revert the checkbox visually and toast.
  const togglePattern = /async function onToggle\(e\) \{[\s\S]*?cb\.disabled = false;\s*\}\s*\}/m;
  const togglePatched = `async function onToggle(e) {
        const cb = e.target;
        if (!cb.matches(".checkbox")) return;
        cb.checked = !cb.checked;
        toast("Read-only on the deployed dashboard — edit locally", "error");
      }`;
  out = out.replace(togglePattern, togglePatched);

  return out;
}

async function main() {
  // Wipe and recreate dist/.
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Manifest mirrors what the /docs endpoint returns at runtime.
  const docs = await listDocs();
  await writeFile(
    resolve(DIST, "docs.json"),
    JSON.stringify({ docs }, null, 2),
  );

  // Copy every referenced markdown file into dist/docs/<path>.
  for (const d of docs) {
    try {
      await copyMarkdown(d.file);
    } catch (e) {
      console.warn(`[build] missing ${d.file} — skipped:`, e.message);
    }
  }

  // Patch + write index.html.
  const html = await readFile(resolve(ROOT, "index.html"), "utf8");
  await writeFile(resolve(DIST, "index.html"), patchHtml(html));

  // Copy preview images so og:image references keep working.
  for (const img of ["preview.png", "preview-brainstorm.png", "preview-checklist.png"]) {
    try {
      await copyFile(resolve(ROOT, img), resolve(DIST, img));
    } catch { /* optional */ }
  }

  console.log(`\n  Static EML build → ${DIST}`);
  console.log(`  Docs: ${docs.length}\n`);
}

main().catch((err) => {
  console.error("[build] fatal:", err);
  process.exit(1);
});
