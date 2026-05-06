#!/usr/bin/env node
//
// Normalise Capacitor's iOS Package.swift to POSIX-style path separators.
//
// `npx cap sync` writes the local node_modules path into Package.swift using
// the host OS's path separator. On Windows that's backslashes, which Swift
// Package Manager on macOS rejects when Xcode tries to resolve packages.
// Without this fix, every TestFlight build off a Windows-synced repo fails
// with "could not locate package" on first attempt.
//
// Idempotent: forward-slashes pass through untouched. Safe to run after
// every `npx cap sync` regardless of host OS.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const TARGET = resolve(process.cwd(), "ios", "App", "CapApp-SPM", "Package.swift");

if (!existsSync(TARGET)) {
  // No iOS project yet — silent no-op so this script doesn't fail in CI
  // contexts that build the web bundle without the native shells.
  process.exit(0);
}

const original = await readFile(TARGET, "utf8");

// Only touch the relative-path strings inside `path: "..."` package entries.
// A blunt s/\\/\//g would also rewrite the swift-tools comment header on
// Windows checkouts that somehow got CRLF-mangled, so anchor the rewrite
// to the package(...) call shape.
const fixed = original.replace(
  /(\.package\([^)]*?path:\s*")([^"]+?)(")/g,
  (_match, pre, path, post) => `${pre}${path.replaceAll("\\", "/")}${post}`,
);

if (fixed === original) {
  process.exit(0);
}

await writeFile(TARGET, fixed, "utf8");
console.log("[fix-cap-paths] normalised Package.swift backslashes -> forward slashes");
