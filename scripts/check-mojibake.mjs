#!/usr/bin/env node
// Mojibake / corrupted-UTF-8 guard.
//
// Lessons-learned: never edit docs with `perl -0pi` / `sed -i`; without a UTF-8
// binmode they round-trip text through Latin-1 and produce mojibake — the
// section sign U+00A7 becomes the two chars U+00C2 U+00A7, an em dash becomes a
// three-char "a-circumflex + euro" sequence, emoji become "eth + small-y"
// runs, and checkboxes corrupt similarly. This guard rejects those signatures
// (and the U+FFFD replacement char) WITHOUT false-positiving on legitimate
// accented i18n text (es/pt/fr/nl/de), which charter §12 requires us to support.
//
// All patterns below are built from \u escapes on purpose, so THIS source file
// contains no literal mojibake bytes and never flags itself.
//
// Usage:
//   node scripts/check-mojibake.mjs            # scan git-staged text files
//   node scripts/check-mojibake.mjs --all      # scan all tracked text files
//   node scripts/check-mojibake.mjs file...    # scan explicit paths

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

// Text-ish extensions we own and edit by hand. Binary/asset files are skipped.
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".jsonc",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".sql",
  ".toml",
  ".env",
  ".sh",
]);

// This checker is excluded from its own scan as defense-in-depth (it would
// otherwise need to embed the very bytes it hunts for).
const SELF_PATH = "scripts/check-mojibake.mjs";

// Each pattern is a known double-encoding signature. The leading bytes
// (U+00C2, U+00E2, U+00F0) only precede these specific continuations when UTF-8
// has been mis-decoded as Latin-1 and re-encoded.
const MOJIBAKE_PATTERNS = [
  // U+FFFD replacement character — always corruption.
  /�/,
  // U+00C2 + Latin-1 punctuation/symbol block (NBSP, section, degree, ©, ®, …).
  /Â[ -¿]/,
  // U+00E2 U+20AC — signature of mis-decoded E2 80 xx (smart quotes, dashes, ellipsis).
  /â€/,
  // U+00E2 + arrows/symbols/checkboxes (mis-decoded E2 86/98/9C/9E xx).
  /â[†œˆ‰š™‚—“”]/,
  // U+00F0 U+0178 — mis-decoded 4-byte emoji (F0 9F xx xx).
  /ðŸ/,
];

function listStagedFiles() {
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
    { encoding: "utf8" }
  );
  return out.split("\n").filter(Boolean);
}

function listTrackedFiles() {
  const out = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function isTextFile(path) {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

function scanFile(path) {
  let content;
  try {
    if (!statSync(path).isFile()) {
      return [];
    }
    content = readFileSync(path, "utf8");
  } catch {
    return []; // deleted/unreadable — nothing to scan
  }
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of MOJIBAKE_PATTERNS) {
      if (pattern.test(line)) {
        hits.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
        break;
      }
    }
  }
  return hits;
}

function resolveTargets(argv) {
  const args = argv.slice(2);
  if (args.includes("--all")) {
    return listTrackedFiles();
  }
  const explicit = args.filter((a) => !a.startsWith("--"));
  if (explicit.length > 0) {
    return explicit;
  }
  return listStagedFiles();
}

function main() {
  const targets = resolveTargets(process.argv)
    .filter(isTextFile)
    .filter((p) => p !== SELF_PATH);
  const failures = [];
  for (const path of targets) {
    const hits = scanFile(path);
    if (hits.length > 0) {
      failures.push({ path, hits });
    }
  }

  if (failures.length === 0) {
    return;
  }

  process.stderr.write(
    "\n[x] Mojibake / corrupted UTF-8 detected (see lessons-learned: never edit docs with perl/sed/awk):\n\n"
  );
  for (const { path, hits } of failures) {
    for (const { line, snippet } of hits) {
      process.stderr.write(`  ${path}:${line}: ${snippet}\n`);
    }
  }
  process.stderr.write(
    "\nFix the corrupted characters (restore from `git show HEAD:<file>` and re-apply edits with an editor), then re-commit.\n"
  );
  process.exit(1);
}

main();
