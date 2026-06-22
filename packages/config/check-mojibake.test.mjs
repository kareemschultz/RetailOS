// Regression coverage for scripts/check-mojibake.mjs (Codex PR #2 findings).
//
// Finding 1: staged/pre-commit mode must scan the STAGED BLOB from the Git
//   index, not the working tree -- a corrupted staged blob must fail even when
//   the worktree copy is clean; a clean staged blob must pass.
// Finding 2: E2 98 xx checkbox/checklist corruption (clean glyphs U+2610/11/12)
//   must be detected, in both the cp1252-rendered form and the Latin-1
//   C1-control form; valid clean checkbox glyphs must pass.
//
// Each test runs the real script inside an isolated throwaway git repo (in the
// OS temp dir) so it never touches this repo's index. Fixture strings are built
// from numeric codepoints so this test source carries no literal mojibake bytes
// (which the guard would otherwise flag in this very file).

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "check-mojibake.mjs"
);

// Mojibake fixtures built from codepoints (no literal mojibake bytes in source).
// section-sign double-encoding: U+00C2 U+00A7
const MOJIBAKE_SECTION = `Charter ${String.fromCharCode(0xc2, 0xa7)} corrupt\n`;
// checkbox cp1252-rendered form: U+00E2 U+02DC U+2018
const CHECKBOX_CP1252 = `- ${String.fromCharCode(0xe2, 0x02_dc, 0x20_18)} task\n`;
// checkbox Latin-1 C1-control form: U+00E2 U+0098 U+0091
const CHECKBOX_C1 = `- ${String.fromCharCode(0xe2, 0x98, 0x91)} task\n`;
const CLEAN_TEXT = "Charter section ref - clean\n";
// clean checkbox glyphs: U+2611 (ballot-check) U+2610 (ballot) U+2612 (ballot-x)
const CLEAN_CHECKBOXES = `${String.fromCharCode(0x26_11)} ${String.fromCharCode(0x26_10)} ${String.fromCharCode(0x26_12)} done\n`;

const repos = [];

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), "mojibake-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "test"]);
  repos.push(dir);
  return dir;
}

function gitAdd(dir, file) {
  execFileSync("git", ["add", file], { cwd: dir, stdio: "pipe" });
}

function write(dir, file, content) {
  writeFileSync(join(dir, file), content);
}

// Run the guard and return its exit code (0 = clean, 1 = mojibake found).
function runGuard(dir, args = []) {
  try {
    execFileSync("node", [SCRIPT, ...args], { cwd: dir, stdio: "pipe" });
    return 0;
  } catch (err) {
    return typeof err.status === "number" ? err.status : 1;
  }
}

afterEach(() => {
  for (const dir of repos.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("check-mojibake -- staged blob scanning (finding 1)", () => {
  it("fails on a corrupted STAGED blob even when the worktree copy is clean", () => {
    const dir = initRepo();
    write(dir, "doc.md", MOJIBAKE_SECTION); // stage corrupt bytes
    gitAdd(dir, "doc.md");
    write(dir, "doc.md", CLEAN_TEXT); // worktree now clean (index still corrupt)
    // Sanity: the worktree copy alone passes...
    expect(runGuard(dir, ["doc.md"])).toBe(0);
    // ...but staged mode (default) must catch the corrupt index blob.
    expect(runGuard(dir)).toBe(1);
  });

  it("passes when the STAGED blob is clean", () => {
    const dir = initRepo();
    write(dir, "doc.md", CLEAN_TEXT);
    gitAdd(dir, "doc.md");
    expect(runGuard(dir)).toBe(0);
  });
});

describe("check-mojibake -- checkbox/checklist corruption (finding 2)", () => {
  it("fails on a corrupted checkbox staged blob (cp1252 form)", () => {
    const dir = initRepo();
    write(dir, "PROGRESS.md", CHECKBOX_CP1252);
    gitAdd(dir, "PROGRESS.md");
    expect(runGuard(dir)).toBe(1);
  });

  it("fails on a corrupted checkbox staged blob (Latin-1 C1 form)", () => {
    const dir = initRepo();
    write(dir, "PROGRESS.md", CHECKBOX_C1);
    gitAdd(dir, "PROGRESS.md");
    expect(runGuard(dir)).toBe(1);
  });

  it("passes on valid clean checkbox glyphs", () => {
    const dir = initRepo();
    write(dir, "PROGRESS.md", CLEAN_CHECKBOXES);
    gitAdd(dir, "PROGRESS.md");
    expect(runGuard(dir)).toBe(0);
  });
});
