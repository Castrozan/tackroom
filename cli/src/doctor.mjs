import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { requireConfigurationDirectory, untrackedFiles } from "./apply.mjs";
import { currentNixSystem, locateNix, nix } from "./nix.mjs";
import { fail, note, ok, step, warn } from "./ui.mjs";

const HARNESS_EVIDENCE = [
  { name: "Claude Code", instructions: ".claude/CLAUDE.md", settings: ".claude/settings.json" },
  { name: "Codex", instructions: ".codex/AGENTS.md", settings: ".codex/config.toml" },
  {
    name: "OpenCode",
    instructions: ".config/opencode/AGENTS.md",
    settings: ".config/opencode/opencode.json",
  },
];

function readIdentity(configurationDirectory) {
  const identityPath = join(configurationDirectory, "identity.nix");
  if (!existsSync(identityPath)) return null;
  return readFile(identityPath, "utf8");
}

function quotedField(source, field) {
  return source.match(new RegExp(`${field}\\s*=\\s*"([^"]*)"`))?.[1] ?? null;
}

async function reportNix(problems) {
  const nixPath = await locateNix();
  if (!nixPath) {
    fail("Nix is not installed. Run `npx tackroom init` or install it yourself.");
    problems.push("nix");
    return null;
  }
  const version = await nix(nixPath, ["--version"], { capture: true });
  ok(`Nix at ${nixPath} (${version.stdout.trim() || "version unknown"})`);
  return nixPath;
}

async function reportIdentity(configurationDirectory, problems) {
  const identity = await readIdentity(configurationDirectory);
  if (identity === null) {
    fail("identity.nix is missing, so the flake cannot know which user to build for.");
    problems.push("identity");
    return;
  }
  const expected = {
    username: userInfo().username,
    homeDirectory: homedir(),
    system: currentNixSystem(),
  };
  for (const [field, value] of Object.entries(expected)) {
    const recorded = quotedField(identity, field);
    if (recorded === value) continue;
    warn(`identity.nix says ${field} is ${recorded}, this machine says ${value}`);
    note("That is correct when you share one repository across machines; edit identity.nix otherwise.");
  }
  ok("identity.nix is readable");
}

async function reportTracking(configurationDirectory, problems) {
  const untracked = await untrackedFiles(configurationDirectory);
  if (untracked.length === 0) {
    ok("git is tracking every file, so the flake sees the whole configuration");
    return;
  }
  fail("These files exist but git is not tracking them, so the build cannot see them:");
  for (const file of untracked) note(file);
  note("Run `git add .` or `npx tackroom apply`, which stages them for you.");
  problems.push("untracked");
}

function reportHarnesses() {
  for (const harness of HARNESS_EVIDENCE) {
    const instructionsPath = join(homedir(), harness.instructions);
    const settingsPath = join(homedir(), harness.settings);
    if (!existsSync(instructionsPath)) {
      note(`${harness.name}: not configured by tackroom on this machine`);
      continue;
    }
    const settingsState = existsSync(settingsPath) ? "settings present" : "settings not written yet";
    ok(`${harness.name}: instructions deployed, ${settingsState}`);
  }
}

export async function diagnose({ directory }) {
  const configurationDirectory = requireConfigurationDirectory(directory);
  const problems = [];

  step("Toolchain");
  await reportNix(problems);

  step("Configuration");
  await reportIdentity(configurationDirectory, problems);
  await reportTracking(configurationDirectory, problems);

  step("Deployed harnesses");
  reportHarnesses();

  if (problems.length > 0) {
    process.exitCode = 1;
    return;
  }
  step("Nothing to fix");
}
