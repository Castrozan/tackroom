import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfiguration } from "./config.mjs";
import { engineVersion, generate } from "./engine.mjs";
import { renderSource } from "./source.mjs";
import { note, ok, step } from "./ui.mjs";

async function makeHooksExecutable(configuration) {
  const commands = Object.values(configuration.hooks)
    .flat()
    .map((definition) => definition?.command?.split(" ")[0])
    .filter((executable) => typeof executable === "string" && executable.startsWith(configuration.root));

  for (const executable of new Set(commands)) {
    const information = await stat(executable).catch(() => null);
    if (information === null || !information.isFile()) continue;
    await chmod(executable, information.mode | 0o111);
  }
  return new Set(commands).size;
}

export async function withRenderedSource(configuration, body) {
  const workspace = await mkdtemp(join(tmpdir(), "tackroom-"));
  try {
    await renderSource(configuration, workspace);
    return await body(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function applyConfiguration({ directory }) {
  const configuration = await loadConfiguration(directory);

  const executableCount = await makeHooksExecutable(configuration);
  if (executableCount > 0) {
    step("Marking hook scripts executable");
    ok(`${executableCount} hook ${executableCount === 1 ? "script" : "scripts"} can run`);
  }

  step(`Projecting onto ${configuration.harnesses.join(", ")}`);
  note(`rulesync ${engineVersion()} does the per-harness translation`);

  await withRenderedSource(configuration, (workspace) => generate({ sourceRoot: workspace }));

  ok("Every declared harness now matches this configuration");
  note("Restart a running agent session for it to reload the new files.");
}
