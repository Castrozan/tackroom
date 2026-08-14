import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withRenderedSource } from "./apply.mjs";
import { CONFIGURATION_FILE_NAME, HARNESSES, parseConfiguration } from "./config.mjs";
import { enginePath, engineVersion, run } from "./engine.mjs";
import { fail, note, ok, step, warn } from "./ui.mjs";

async function checkUpToDate(configuration, sourceRoot) {
  return run(
    process.execPath,
    [
      enginePath(),
      "generate",
      "--global",
      "--check",
      "--input-root",
      sourceRoot,
      "--config",
      join(sourceRoot, "rulesync.jsonc"),
    ],
    { cwd: sourceRoot, capture: true },
  );
}

export async function diagnose({ directory }) {
  const root = resolve(directory ?? process.cwd());
  const problems = [];

  step("Configuration");
  const path = join(root, CONFIGURATION_FILE_NAME);
  if (!existsSync(path)) {
    fail(`${root} holds no ${CONFIGURATION_FILE_NAME}`);
    note("Run `npx tackroom init` here to scaffold one.");
    process.exitCode = 1;
    return;
  }

  const { configuration, problems: declarationProblems } = parseConfiguration(
    await readFile(path, "utf8"),
    root,
  );

  if (declarationProblems.length > 0) {
    for (const problem of declarationProblems) fail(problem);
    problems.push(...declarationProblems);
  } else {
    ok(`${CONFIGURATION_FILE_NAME} reads cleanly`);
  }

  step("What is declared");
  for (const harness of configuration.harnesses) ok(`${HARNESSES[harness].displayName} is enabled`);
  for (const harness of Object.keys(HARNESSES)) {
    if (!configuration.harnesses.includes(harness))
      note(`${HARNESSES[harness].displayName} is not enabled here`);
  }

  const hookCount = Object.values(configuration.hooks).flat().length;
  if (hookCount > 0) {
    ok(
      `${hookCount} hook ${hookCount === 1 ? "definition" : "definitions"} across ${Object.keys(configuration.hooks).length} ${Object.keys(configuration.hooks).length === 1 ? "event" : "events"}`,
    );
    if (configuration.harnesses.includes("opencode")) {
      warn("OpenCode hooks run through a generated plugin that passes no payload on stdin");
      note("A hook there can refuse by exiting non-zero, but cannot read what it is refusing.");
    }
  }

  if (declarationProblems.length > 0) {
    process.exitCode = 1;
    return;
  }

  step("What is deployed");
  note(`checking against rulesync ${engineVersion()}`);
  const result = await withRenderedSource(configuration, (workspace) =>
    checkUpToDate(configuration, workspace),
  );

  if (result.code === 0) {
    ok("Every harness matches this configuration");
  } else {
    warn("The deployed files no longer match this configuration");
    for (const line of (result.stdout || result.stderr || "").trim().split("\n")) note(line);
    note("Run `npx tackroom apply` to bring them back in step.");
    problems.push("stale");
  }

  step("Summary");
  if (problems.length === 0) {
    ok("Nothing to fix");
    return;
  }
  fail(
    problems.length === 1
      ? "1 problem above needs attention"
      : `${problems.length} problems above need attention`,
  );
  process.exitCode = 1;
}
