import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseConfiguration } from "../cli/src/config.mjs";
import { parseJsonc } from "../cli/src/jsonc.mjs";

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), "tackroom-config-"));
  await mkdir(join(root, "hooks"), { recursive: true });
  await writeFile(join(root, "instructions.md"), "Be careful.\n", "utf8");
  await writeFile(join(root, "hooks", "guard.mjs"), "#!/usr/bin/env node\n", "utf8");
  return root;
}

const MINIMAL = { harnesses: ["claude"], instructions: "instructions.md" };

test("jsonc keeps comment characters that live inside strings", () => {
  const parsed = parseJsonc(`{
    // a leading comment
    "command": "grep // in a url", /* trailing */
    "path": "https://example.com",
  }`);
  assert.deepEqual(parsed, { command: "grep // in a url", path: "https://example.com" });
});

test("an unknown key is reported rather than ignored", async () => {
  const root = await fixtureRoot();
  const { problems } = parseConfiguration(JSON.stringify({ ...MINIMAL, harneses: [] }), root);
  assert.ok(problems.some((problem) => problem.includes("harneses")));
});

test("a relative hook command becomes an absolute path", async () => {
  const root = await fixtureRoot();
  const { configuration, problems } = parseConfiguration(
    JSON.stringify({ ...MINIMAL, hooks: { preToolUse: [{ command: "./hooks/guard.mjs" }] } }),
    root,
  );
  assert.deepEqual(problems, []);
  assert.equal(configuration.hooks.preToolUse[0].command, join(root, "hooks", "guard.mjs"));
});

test("a hook pointing at a missing script is refused", async () => {
  const root = await fixtureRoot();
  const { problems } = parseConfiguration(
    JSON.stringify({ ...MINIMAL, hooks: { preToolUse: [{ command: "./hooks/absent.mjs" }] } }),
    root,
  );
  assert.ok(problems.some((problem) => problem.includes("absent.mjs")));
});

test("a bare hook command is left alone so PATH still resolves it", async () => {
  const root = await fixtureRoot();
  const { configuration } = parseConfiguration(
    JSON.stringify({ ...MINIMAL, hooks: { preToolUse: [{ command: "shellcheck --version" }] } }),
    root,
  );
  assert.equal(configuration.hooks.preToolUse[0].command, "shellcheck --version");
});

test("a suffix for a harness that is not enabled is refused", async () => {
  const root = await fixtureRoot();
  const { problems } = parseConfiguration(
    JSON.stringify({ ...MINIMAL, instructionsSuffix: { codex: "Codex only." } }),
    root,
  );
  assert.ok(problems.some((problem) => problem.includes("codex")));
});

test("declaring nothing is refused rather than deploying empty harnesses", async () => {
  const root = await fixtureRoot();
  const { problems } = parseConfiguration(JSON.stringify({ harnesses: ["claude"] }), root);
  assert.ok(problems.some((problem) => problem.includes("nothing is declared")));
});

test("an absolute path is refused so the configuration stays portable", async () => {
  const root = await fixtureRoot();
  const { problems } = parseConfiguration(
    JSON.stringify({ harnesses: ["claude"], instructions: "/etc/AGENTS.md" }),
    root,
  );
  assert.ok(problems.some((problem) => problem.includes("portable")));
});
