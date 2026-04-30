#!/usr/bin/env node
// Tiny zero-dep HTTP server for the launch dashboard.
// - GET /             → index.html
// - GET /checklist    → raw LAUNCH_CHECKLIST.md (with x-mtime header)
// - POST /toggle      → { lineNumber, checked } flips `[ ]` ↔ `[x]` on that line
//
// Why no Express / Vite: this dashboard is the single source of truth for
// pre/launch/post-launch tasks; spinning up a serverless framework just to
// edit a file is overkill. Run with: `node EverionMindLaunch/server.mjs`.

import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKLIST_PATH = resolve(__dirname, "LAUNCH_CHECKLIST.md");
const INDEX_PATH = resolve(__dirname, "index.html");
const PORT = Number(process.env.PORT || 5174);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(body);
}

async function readChecklist() {
  const [content, st] = await Promise.all([
    readFile(CHECKLIST_PATH, "utf8"),
    stat(CHECKLIST_PATH),
  ]);
  return { content, mtime: st.mtimeMs };
}

async function toggleLine(lineNumber, checked) {
  const { content } = await readChecklist();
  const lines = content.split(/\r?\n/);
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) throw new Error(`line ${lineNumber} out of range`);

  const line = lines[idx];
  const checkboxRe = /^(\s*-\s*)\[([ xX])\](.*)$/;
  const match = checkboxRe.exec(line);
  if (!match) throw new Error(`line ${lineNumber} is not a checkbox: ${line.slice(0, 80)}`);

  const [, prefix, , rest] = match;
  const next = `${prefix}[${checked ? "x" : " "}]${rest}`;
  if (next === line) return { changed: false }; // already in target state

  lines[idx] = next;
  await writeFile(CHECKLIST_PATH, lines.join("\n"), "utf8");
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
      // Inline 1x1 transparent PNG so the browser stops requesting it.
      return send(res, 204, "", { "Content-Type": "image/x-icon" });
    }

    if (req.method === "GET" && url.pathname === "/checklist") {
      const { content, mtime } = await readChecklist();
      return send(res, 200, content, {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-mtime": String(mtime),
      });
    }

    if (req.method === "POST" && url.pathname === "/toggle") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const { lineNumber, checked } = body;
      if (typeof lineNumber !== "number" || typeof checked !== "boolean") {
        return send(res, 400, JSON.stringify({ error: "lineNumber:number, checked:boolean" }), {
          "Content-Type": "application/json",
        });
      }
      const result = await toggleLine(lineNumber, checked);
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
  console.log(`\n  Everion Launch Dashboard`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  Source: ${CHECKLIST_PATH}\n`);
});
