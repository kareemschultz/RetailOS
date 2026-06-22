#!/usr/bin/env node
// Mojibake / corrupted-UTF-8 guard.
//
// Lessons-learned: never edit docs with `perl -0pi` / `sed -i`; without a UTF-8
// binmode they round-trip text through Latin-1 and produce mojibake. This guard
// rejects those signatures (and the U+FFFD replacement char) WITHOUT
// false-positiving on legitimate accented i18n text (es/pt/fr/nl/de), which the
// charter (section 12) requires us to support.
//
// IMPORTANT (Codex finding #1): in staged/pre-commit mode the guard scans the
// STAGED BLOB from the Git index (`git show :<path>`), NOT the working tree --
// so a corrupted blob cannot slip through just because the worktree copy is
// clean. Full-scan (--all) and explicit-path modes read the working tree.
//
// The mojibake patterns are built at load time from numeric codepoints via
// String.fromCharCode, so THIS source file is pure ASCII: it contains no literal
// mojibake / control bytes, never flags itself, and never trips a
// control-char-in-regex lint.
//
// Usage:
//   node scripts/check-mojibake.mjs            # scan git-STAGED blobs (index)
//   node scripts/check-mojibake.mjs --all      # scan all tracked worktree files
//   node scripts/check-mojibake.mjs file...    # scan explicit worktree paths

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

// This checker is excluded from its own scan as defense-in-depth.
const SELF_PATH = "scripts/check-mojibake.mjs";

const ch = (cp) => String.fromCharCode(cp);
const range = (lo, hi) => `${ch(lo)}-${ch(hi)}`;

// C1 control block U+0080..U+009F: a UTF-8 continuation byte decoded as Latin-1
// renders here. Non-printable controls that never appear in legitimate
// source/Markdown -- a reliable byte-level mojibake signal.
const C1 = range(0x80, 0x9f);

// cp1252 "special" codepoints (the glyphs bytes 0x80..0x9F map to under
// Windows-1252): smart quotes, em/en dash, ellipsis, bullet, dagger, trademark,
// the modifier letters U+02C6 and U+02DC (U+02DC is the 2nd char of a mojibaked
// checkbox), and the OE/S/Z/Y-diaeresis/florin glyphs.
const CP1252_SPECIALS = [
  0x1_52, 0x1_53, 0x1_60, 0x1_61, 0x1_7d, 0x1_7e, 0x1_78, 0x1_92, 0x2_c6,
  0x2_dc, 0x20_13, 0x20_14, 0x20_18, 0x20_19, 0x20_1a, 0x20_1c, 0x20_1d,
  0x20_1e, 0x20_20, 0x20_21, 0x20_22, 0x20_26, 0x20_30, 0x20_39, 0x20_3a,
  0x20_ac, 0x21_22,
]
  .map(ch)
  .join("");

// Each pattern is a known UTF-8 double-encoding signature.
const MOJIBAKE_PATTERNS = [
  // U+FFFD replacement character -- always corruption.
  new RegExp(ch(0xff_fd)),
  // C1 controls: the Latin-1 form of ANY mojibake (the failure mode perl/sed hit
  // without binmode). Alone, catches the section sign, em dashes, emoji, AND
  // checkboxes (E2 98 9x corrupts to U+00E2 U+0098 ..., and U+0098 is C1).
  new RegExp(`[${C1}]`),
  // U+00C2 + Latin-1 punctuation/symbol (U+00A0..U+00BF): cp1252-rendered 2-byte
  // mojibake (the section sign C2 A7 becomes U+00C2 U+00A7). Letters EXCLUDED
  // (range starts at U+00A0) so French capital-A-circumflex words pass.
  new RegExp(`${ch(0xc2)}[${range(0xa0, 0xbf)}]`),
  // U+00E2 + a cp1252 special char: cp1252-rendered 3-byte mojibake (E2 8x/9x
  // xx) -- smart quotes/dashes/ellipsis/bullet/dagger/trademark and checkboxes.
  new RegExp(`${ch(0xe2)}[${CP1252_SPECIALS}]`),
  // U+00F0 + (U+0178 | C1): rendered 4-byte emoji mojibake (F0 9F xx xx).
  new RegExp(`${ch(0xf0)}[${ch(0x1_78)}${C1}]`),
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

// Read the STAGED blob from the index (what will actually be committed).
function readStagedBlob(path) {
  try {
    return execFileSync("git", ["show", `:${path}`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null; // not in index (e.g. deleted) -- nothing to scan
  }
}

// Read the working-tree copy.
function readWorktree(path) {
  try {
    if (!statSync(path).isFile()) {
      return null;
    }
    return readFileSync(path, "utf8");
  } catch {
    return null; // deleted/unreadable -- nothing to scan
  }
}

function scanContent(content) {
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

// Returns { targets, read } for the chosen mode.
//   default      -> staged blobs from the index (pre-commit correctness)
//   --all        -> all tracked worktree files
//   explicit ... -> the given worktree paths
function resolveMode(argv) {
  const args = argv.slice(2);
  if (args.includes("--all")) {
    return { targets: listTrackedFiles(), read: readWorktree };
  }
  const explicit = args.filter((a) => !a.startsWith("--"));
  if (explicit.length > 0) {
    return { targets: explicit, read: readWorktree };
  }
  return { targets: listStagedFiles(), read: readStagedBlob };
}

function main() {
  const { targets, read } = resolveMode(process.argv);
  const failures = [];
  for (const path of targets) {
    if (!isTextFile(path) || path === SELF_PATH) {
      continue;
    }
    const content = read(path);
    if (content == null) {
      continue;
    }
    const hits = scanContent(content);
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
