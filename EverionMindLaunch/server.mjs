#!/usr/bin/env node
// Tiny zero-dep HTTP server for the launch knowledge base.
// - GET /                    → index.html
// - GET /favicon.ico         → 204
// - GET /docs                → JSON listing of every doc (with mtimes)
// - GET /docs/{path}         → raw markdown for any .md file under EverionMindLaunch/
// - POST /toggle             → { docPath, lineNumber, checked } flips `[ ]` ↔ `[x]`
//
// Why no Express / Vite: the launch knowledge base is the single source of
// truth for pre/launch/post-launch tasks; spinning up a serverless framework
// just to read + edit markdown is overkill. Run with: `node EverionMindLaunch/server.mjs`.

import { createServer } from "node:http";
import { readFile, writeFile, stat, readdir } from "node:fs/promises";
import { dirname, resolve, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INDEX_PATH = resolve(ROOT, "index.html");
const PORT = Number(process.env.PORT || 5174);

// Doc registry — display name + path + role. The order here is the order
// shown in the dashboard library, so put action-oriented docs first.
// Files in AUTO_GROUPS dirs (below) are picked up automatically — no need
// to list them here unless you want to override the title or pin order.
const DOCS = [
  // Hub — first thing in the library, the launch playbook
  { id: "playbook",     file: "PLAYBOOK.md",         title: "Playbook (start here)", role: "doc" },
  { id: "checklist",    file: "LAUNCH_CHECKLIST.md", title: "Checklist",    role: "checklist" },
  { id: "roadmap",      file: "ROADMAP.md",          title: "Roadmap",      role: "doc" },
  { id: "strategy",     file: "STRATEGY.md",         title: "Strategy",     role: "doc" },
  { id: "research",     file: "RESEARCH.md",         title: "Research",     role: "doc" },
  { id: "brainstorm",   file: "BRAINSTORM.md",       title: "Brainstorm",   role: "doc" },
  // Architecture group — INDEX is the entry point, sub-docs are siblings
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

// Auto-discovery — drop a `.md` file into one of these dirs and it appears
// in the dashboard with no server edit. Title comes from the first `# H1`,
// fallback to filename. Sort order applies within the group.
const AUTO_GROUPS = [
  // Active in-flight work. Renders at the top of the dashboard so the
  // current sprint is the first thing seen on every visit. Move .md
  // files into Working/archive/ once shipped.
  { dir: "Working", group: "working", sort: "mtime-desc" },
  { dir: "Working/archive", group: "working-archive", sort: "mtime-desc" },
  { dir: "Audits", group: "audits", sort: "mtime-desc" },
  // Audits move here once addressed — kept for context, demoted in the UI
  // so they don't pollute the active "Audits" tab.
  { dir: "Audits/archive", group: "audits-archive", sort: "mtime-desc" },
  // Marketing folder — paste-ready launch assets. Each subfolder gets its
  // own group so PH/Twitter/email don't bleed into one big list. Add new
  // subfolders here when launching new channels (e.g. marketing/HackerNews,
  // marketing/Reddit, marketing/Email). Top-level marketing/*.md files
  // (playbooks, strategy docs that aren't channel-specific) land in the
  // generic "marketing-playbooks" group — the readdir/file filter excludes
  // subdirectories so ProductHunt/ entries don't double-count.
  { dir: "marketing", group: "marketing-playbooks", sort: "mtime-desc" },
  { dir: "marketing/ProductHunt", group: "marketing-producthunt", sort: "name-asc" },
  // Sprint plan — week-by-week pre/launch/post-launch detail
  { dir: "Roadmap", group: "roadmap", sort: "name-asc" },
  // Cross-cutting reference docs
  { dir: "Specs", group: "specs", sort: "mtime-desc" },
  { dir: "Specs/archive", group: "specs-archive", sort: "mtime-desc" },
  { dir: "Ops", group: "ops", sort: "name-asc" },
  { dir: "Legal", group: "legal", sort: "name-asc" },
  { dir: "Support", group: "support", sort: "name-asc" },
  { dir: "Brand", group: "brand", sort: "name-asc" },
  { dir: "Mobile", group: "mobile", sort: "name-asc" },
  { dir: "Analytics", group: "analytics", sort: "name-asc" },
  // Future drop-in folders just add another entry here.
];

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(body);
}

// Path-traversal guard — only serve .md files inside ROOT
function safeResolve(rel) {
  const abs = resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + sep) && abs !== ROOT) throw new Error("path escapes root");
  if (!abs.endsWith(".md")) throw new Error("only .md files served");
  return abs;
}

async function readDoc(rel) {
  const abs = safeResolve(rel);
  const [content, st] = await Promise.all([readFile(abs, "utf8"), stat(abs)]);
  return { content, mtime: st.mtimeMs };
}

// Read the first `# H1` from a markdown file. Returns null if none found
// in the first ~40 lines (cheap heuristic — H1 always sits near the top).
async function readFirstH1(absPath) {
  try {
    const content = await readFile(absPath, "utf8");
    const head = content.split(/\r?\n/, 40);
    for (const line of head) {
      const m = /^#\s+(.+?)\s*$/.exec(line);
      if (m) return m[1].trim();
    }
  } catch { /* unreadable — fall through */ }
  return null;
}

// Slug + fallback title from a filename. Strips date prefix if present.
function fallbackTitleFromFile(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/^(\d{4}-\d{2}-\d{2})[-_]?/, "")  // strip leading YYYY-MM-DD
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Walk every AUTO_GROUPS dir and produce doc entries for the .md files.
async function discoverAutoDocs() {
  const out = [];
  for (const group of AUTO_GROUPS) {
    const absDir = resolve(ROOT, group.dir);
    let entries = [];
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch { continue; } // dir missing → skip silently
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
      const file = `${group.dir}/${ent.name}`;
      const abs = resolve(ROOT, file);
      const st = await stat(abs);
      const h1 = await readFirstH1(abs);
      const title = h1 || fallbackTitleFromFile(ent.name);
      const id = `${group.group}-${ent.name.replace(/\.md$/i, "")}`;
      out.push({ id, file, title, role: "doc", group: group.group, mtime: st.mtimeMs, bytes: st.size });
    }
    // Apply sort within this group only.
    // mtime-desc = newest first (good for active sprint / audits).
    // name-asc = alphabetic by file name (good for paste-ready asset
    //   folders where the natural reading order is hunter → upcoming →
    //   maker-comment → launch-day-checklist).
    if (group.sort === "mtime-desc") {
      out.sort((a, b) => (a.group === group.group && b.group === group.group) ? b.mtime - a.mtime : 0);
    } else if (group.sort === "name-asc") {
      out.sort((a, b) =>
        (a.group === group.group && b.group === group.group) ? a.file.localeCompare(b.file) : 0,
      );
    }
  }
  return out;
}

async function listDocs() {
  const out = [];
  const seenFiles = new Set();
  for (const doc of DOCS) {
    try {
      const st = await stat(resolve(ROOT, doc.file));
      out.push({ ...doc, mtime: st.mtimeMs, bytes: st.size });
      seenFiles.add(doc.file);
    } catch {
      // file missing — skip from listing
    }
  }
  // Auto-discovered docs append after curated ones. Curated wins on
  // file-path collision, so any audit can be promoted into DOCS to
  // override its title or fix its order.
  const auto = await discoverAutoDocs();
  for (const doc of auto) {
    if (seenFiles.has(doc.file)) continue;
    out.push(doc);
  }
  return out;
}

async function toggleLine(rel, lineNumber, checked) {
  const abs = safeResolve(rel);
  const content = await readFile(abs, "utf8");
  const lines = content.split(/\r?\n/);
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) throw new Error(`line ${lineNumber} out of range`);

  const line = lines[idx];
  const checkboxRe = /^(\s*-\s*)\[([ xX])\](.*)$/;
  const match = checkboxRe.exec(line);
  if (!match) throw new Error(`line ${lineNumber} is not a checkbox: ${line.slice(0, 80)}`);

  const [, prefix, , rest] = match;
  const next = `${prefix}[${checked ? "x" : " "}]${rest}`;
  if (next === line) return { changed: false };

  lines[idx] = next;
  await writeFile(abs, lines.join("\n"), "utf8");
  return { changed: true, line: next };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await readFile(INDEX_PATH, "utf8");
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    if (req.method === "GET" && url.pathname === "/favicon.ico") {
      return send(res, 204, "", { "Content-Type": "image/x-icon" });
    }

    // Doc registry listing — drives the tab nav in the UI
    if (req.method === "GET" && url.pathname === "/docs") {
      const docs = await listDocs();
      return send(res, 200, JSON.stringify({ docs }), {
        "Content-Type": "application/json",
      });
    }

    // Back-compat for the original launch dashboard
    if (req.method === "GET" && url.pathname === "/checklist") {
      const { content, mtime } = await readDoc("LAUNCH_CHECKLIST.md");
      return send(res, 200, content, {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-mtime": String(mtime),
      });
    }

    // Generic doc fetch — /docs/<rel-path-from-EverionMindLaunch>
    if (req.method === "GET" && url.pathname.startsWith("/docs/")) {
      const rel = decodeURIComponent(url.pathname.slice("/docs/".length));
      const { content, mtime } = await readDoc(rel);
      return send(res, 200, content, {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-mtime": String(mtime),
      });
    }

    if (req.method === "POST" && url.pathname === "/toggle") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const { lineNumber, checked, docPath = "LAUNCH_CHECKLIST.md" } = body;
      if (typeof lineNumber !== "number" || typeof checked !== "boolean") {
        return send(res, 400, JSON.stringify({ error: "lineNumber:number, checked:boolean required" }), {
          "Content-Type": "application/json",
        });
      }
      const result = await toggleLine(docPath, lineNumber, checked);
      return send(res, 200, JSON.stringify(result), {
        "Content-Type": "application/json",
      });
    }

    send(res, 404, "not found");
  } catch (err) {
    console.error("[err]", err);
    send(res, 500, JSON.stringify({ error: String(err.message || err) }), {
      "Content-Type": "application/json",
    });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Everion Launch Knowledge Base`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  Source: ${ROOT}`);
  console.log(`  Docs: ${DOCS.length} registered\n`);
});
