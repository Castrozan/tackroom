import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
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
    return null;
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
  return {
    username: quotedField(identity, "username") ?? expected.username,
    homeDirectory: quotedField(identity, "homeDirectory") ?? expected.homeDirectory,
  };
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

const DECLARED_SOURCES = "files: builtins.mapAttrs (_: file: toString file.source) files";

async function declaredSources(nixPath, configurationDirectory, username) {
  const attribute = `.#homeConfigurations."${username}".config.home.file`;
  const evaluated = await nix(nixPath, ["eval", "--json", attribute, "--apply", DECLARED_SOURCES], {
    cwd: configurationDirectory,
    capture: true,
  });
  if (evaluated.code !== 0) return null;
  try {
    return JSON.parse(evaluated.stdout);
  } catch {
    return null;
  }
}

async function deployedSource(path) {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

async function reportHarnesses(nixPath, configurationDirectory, identity, problems) {
  const declared = await declaredSources(nixPath, configurationDirectory, identity.username);
  if (declared === null) {
    fail("This configuration does not evaluate, so nothing can be compared against what is deployed.");
    note("Run `npx tackroom apply` to see the error Nix reports.");
    problems.push("evaluation");
    return;
  }

  for (const harness of HARNESS_EVIDENCE) {
    const declaredSource = declared[harness.instructions];
    if (!declaredSource) {
      note(`${harness.name}: not enabled in this configuration`);
      continue;
    }

    const livePath = join(identity.homeDirectory, harness.instructions);
    const live = await deployedSource(livePath);
    if (live === null) {
      fail(`${harness.name}: declared here but nothing of tackroom's is deployed at ${livePath}`);
      note("Run `npx tackroom apply`.");
      problems.push(harness.name);
      continue;
    }
    if (live !== declaredSource) {
      warn(`${harness.name}: what is deployed is not what this repository now declares`);
      note("Run `npx tackroom apply`.");
      problems.push(harness.name);
      continue;
    }

    const settingsPath = join(identity.homeDirectory, harness.settings);
    const settingsState = existsSync(settingsPath) ? "settings present" : "settings not written yet";
    ok(`${harness.name}: deployed and current, ${settingsState}`);
  }
}

export async function diagnose({ directory }) {
  const configurationDirectory = requireConfigurationDirectory(directory);
  const problems = [];

  step("Toolchain");
  const nixPath = await reportNix(problems);

  step("Configuration");
  const identity = await reportIdentity(configurationDirectory, problems);
  await reportTracking(configurationDirectory, problems);

  if (nixPath && identity) {
    step("Deployed harnesses");
    await reportHarnesses(nixPath, configurationDirectory, identity, problems);
  }

  if (problems.length > 0) {
    process.exitCode = 1;
    return;
  }
  step("Nothing to fix");
}
