import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { parseConfiguration } from "../cli/src/config.mjs";
import { generate } from "../cli/src/engine.mjs";
import { renderSource } from "../cli/src/source.mjs";

const templateRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "template");

const INSTRUCTION_PATHS = {
  claude: ".claude/CLAUDE.md",
  codex: ".codex/AGENTS.md",
  opencode: ".config/opencode/AGENTS.md",
};

const SKILL_PATHS = [".claude/skills", ".agents/skills", ".config/opencode/skills"];

const HOOK_PATHS = [".claude/settings.json", ".codex/hooks.json"];

const workspaces = [];

async function project(overrides = {}) {
  const declaration = {
    harnesses: ["claude", "codex", "opencode"],
    instructions: "instructions/AGENTS.md",
    skills: "skills",
    subagents: "subagents",
    hooks: { preToolUse: [{ matcher: "[Bb]ash", command: "./hooks/refuse-force-push.mjs" }] },
    ...overrides,
  };

  const { configuration, problems } = parseConfiguration(JSON.stringify(declaration), templateRoot);
  assert.deepEqual(problems, []);

  const workspace = await mkdtemp(join(tmpdir(), "tackroom-projection-"));
  workspaces.push(workspace);
  const home = join(workspace, "home");
  await mkdir(home, { recursive: true });

  await renderSource(configuration, workspace);
  await generate({ sourceRoot: workspace, home, capture: true });
  return home;
}

describe("what the engine actually produces", () => {
  let home;
  let withCodexSuffix;

  before(async () => {
    home = await project();
    withCodexSuffix = await project({
      instructionsSuffix: { codex: "Codex reaches the shell differently." },
    });
  });

  after(async () => {
    for (const workspace of workspaces) await rm(workspace, { recursive: true, force: true });
  });

  test("the instruction body arrives byte-identical on every harness", async () => {
    const bodies = await Promise.all(
      Object.values(INSTRUCTION_PATHS).map((path) => readFile(join(home, path), "utf8")),
    );
    for (const body of bodies) assert.equal(body, bodies[0]);
  });

  test("a harness suffix changes only that harness", async () => {
    const codex = await readFile(join(withCodexSuffix, INSTRUCTION_PATHS.codex), "utf8");
    assert.match(codex, /Codex reaches the shell differently/);

    const claude = await readFile(join(withCodexSuffix, INSTRUCTION_PATHS.claude), "utf8");
    assert.doesNotMatch(claude, /Codex reaches the shell differently/);
    assert.equal(claude, await readFile(join(home, INSTRUCTION_PATHS.claude), "utf8"));
  });

  test("every skill reaches every harness", () => {
    for (const path of SKILL_PATHS) {
      assert.ok(existsSync(join(home, path, "commit", "SKILL.md")), `the commit skill never reached ${path}`);
    }
  });

  test("subagents reach every harness in its own schema", async () => {
    assert.ok(existsSync(join(home, ".claude/agents/reviewer.md")));
    assert.ok(existsSync(join(home, ".codex/agents/reviewer.toml")));
    const opencode = await readFile(join(home, ".config/opencode/agents/reviewer.md"), "utf8");
    assert.match(opencode, /mode: subagent/);
  });

  test("a hook reaches every harness", async () => {
    for (const path of HOOK_PATHS) {
      const document = JSON.parse(await readFile(join(home, path), "utf8"));
      const entry = document.hooks.PreToolUse[0].hooks[0];
      assert.equal(entry.type, "command");
      assert.match(entry.command, /refuse-force-push\.mjs$/);
    }

    const plugin = await readFile(join(home, ".config/opencode/plugins/rulesync-hooks.js"), "utf8");
    assert.match(plugin, /refuse-force-push\.mjs/);
  });

  test("a hook command is an absolute path, so it resolves from any working directory", async () => {
    const settings = JSON.parse(await readFile(join(home, ".claude/settings.json"), "utf8"));
    const command = settings.hooks.PreToolUse[0].hooks[0].command;
    assert.equal(command, join(templateRoot, "hooks", "refuse-force-push.mjs"));
  });

  test("a harness left out of the declaration receives nothing", async () => {
    const claudeOnly = await project({ harnesses: ["claude"] });
    assert.ok(existsSync(join(claudeOnly, INSTRUCTION_PATHS.claude)));
    assert.ok(!existsSync(join(claudeOnly, INSTRUCTION_PATHS.codex)));
    assert.ok(!existsSync(join(claudeOnly, INSTRUCTION_PATHS.opencode)));
  });
});
