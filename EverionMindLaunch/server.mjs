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
// shown in the dashboard tabs, so put action-oriented docs first.
const DOCS = [
  { id: "checklist",    file: "LAUNCH_CHECKLIST.md", title: "Checklist",    role: "checklist" },
  { id: "roadmap",      file: "ROADMAP.md",          title: "Roadmap",      role: "doc" },
  { id: "strategy",     file: "STRATEGY.md",         title: "Strategy",     role: "doc" },
  { id: "research",     file: "RESEARCH.md",         title: "Research",     role: "doc" },
  { id: "brainstorm",   file: "BRAINSTORM.md",       title: "Brainstorm",   role: "doc" },
  { id: "imports-spec", file: "IMPORTS_SPEC.md",     title: "Imports Spec", role: "doc" },
  // Architecture group — INDEX is the entry point, sub-docs are siblings
  { id: "arch-index",   file: "architecture/INDEX.md",   title: "Architecture",   role: "doc",  group: "architecture" },
  { id: "arch-auth",    file: "architecture/auth.md",    title: "Auth",           role: "doc",  group: "architecture" },
  { id: "arch-bell",    file: "architecture/bell.md",    title: "Notification Bell", role: "doc", group: "architecture" },
  { id: "arch-capture", file: "architecture/capture.md", title: "Capture pipeline", role: "doc", group: "architecture" },
  { id: "arch-cron",    file: "architecture/cron.md",    title: "Cron + workflows", role: "doc", group: "architecture" },
  { id: "arch-enrich",  file: "architecture/enrich.md",  title: "Enrichment pipeline", role: "doc", group: "architecture" },
  { id: "arch-gmail",   file: "architecture/gmail.md",   title: "Gmail sync",     role: "doc", group: "architecture" },
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

async function listDocs() {
  const out = [];
  for (const doc of DOCS) {
    try {
      const st = await stat(resolve(ROOT, doc.file));
      out.push({ ...doc, mtime: st.mtimeMs, bytes: st.size });
    } catch {
      // file missing — skip from listing
    }
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
