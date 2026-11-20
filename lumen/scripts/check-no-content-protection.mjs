#!/usr/bin/env node
// Transparency guard: Lumen must never hide its windows from screen sharing
// or recording. Fails CI if any window enables content protection, in config
// or in code.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const failures = [];

const conf = JSON.parse(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
for (const w of conf.app?.windows ?? []) {
  if (w.contentProtected !== false) {
    failures.push(`tauri.conf.json: window "${w.label}" must set "contentProtected": false explicitly`);
  }
}

const banned = [
  /set_content_protected\s*\(\s*true/,
  /content_protected\s*\(\s*true/,
  /setContentProtected\s*\(\s*true/,
  /SetWindowDisplayAffinity/,
  /WDA_EXCLUDEFROMCAPTURE/,
  /sharingType\s*[:=]/,
  /NSWindowSharingNone/,
];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "target", "dist", "gen", ".git"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(rs|ts|tsx|js|mjs)$/.test(name) && !p.endsWith("check-no-content-protection.mjs")) {
      const text = readFileSync(p, "utf8");
      for (const re of banned) if (re.test(text)) failures.push(`${p}: matches ${re}`);
    }
  }
}
walk(join(root, "apps"));
walk(join(root, "crates"));

if (failures.length) {
  console.error("Content-protection guard failed:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("Content-protection guard: OK (no window is hidden from capture)");
