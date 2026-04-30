// Walk dist/stats.html (rollup-plugin-visualizer treemap output) and print
// per-package attribution for the heaviest chunks. Run after `BUNDLE_STATS=1
// npm run build`.
import fs from "node:fs";

const html = fs.readFileSync("dist/stats.html", "utf8");
const m = html.match(/const data\s*=\s*({[\s\S]*?});\s*\n/);
if (!m) {
  console.error("Couldn't find `const data` block in dist/stats.html.");
  process.exit(1);
}
const data = JSON.parse(m[1]);
const parts = data.nodeParts || {};

function find(node, fragment) {
  if (node.name && node.name.includes(fragment)) return node;
  if (!node.children) return null;
  for (const c of node.children) {
    const r = find(c, fragment);
    if (r) return r;
  }
  return null;
}

const PKG_RE = /node_modules[/\\]+(@[^/\\]+[/\\][^/\\]+|[^/\\]+)/;

function walk(node, byPkg = {}) {
  if (!node.children && node.uid && parts[node.uid]) {
    const bytes = parts[node.uid].gzipLength || 0;
    const m = node.name && node.name.match(PKG_RE);
    const pkg = m ? m[1].replace(/\\/g, "/") : "src";
    byPkg[pkg] = (byPkg[pkg] || 0) + bytes;
  }
  if (node.children) for (const c of node.children) walk(c, byPkg);
  return byPkg;
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["lib-", "module-", "Everion-", "index-"];

for (const target of targets) {
  const node = find(data.tree, target);
  if (!node) {
    console.log(`\n>>> ${target} not found`);
    continue;
  }
  const by = walk(node);
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\n>>> ${node.name}  total=${(total / 1024).toFixed(1)} KB`);
  for (const [p, b] of sorted) {
    console.log(`    ${(b / 1024).toFixed(1).padStart(7)} KB  ${p}`);
  }
}
