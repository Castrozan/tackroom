import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join, resolve } from "node:path";
import { applyConfiguration } from "./apply.mjs";
import { currentNixSystem, nix, requireNix, run } from "./nix.mjs";
import { UserFacingError, bold, confirm, note, ok, step } from "./ui.mjs";

const DEFAULT_TEMPLATE = "github:castrozan/tackroom";

function identityFile({ username, homeDirectory, system }) {
  return `{
  username = "${username}";
  homeDirectory = "${homeDirectory}";
  system = "${system}";
}
`;
}

async function ensureGitRepository(directory) {
  if (existsSync(join(directory, ".git"))) return;
  const initialised = await run("git", ["init", "-q", "-b", "main"], { cwd: directory, capture: true });
  if (initialised.code !== 0) {
    throw new UserFacingError(
      "tackroom needs a git repository, because Nix flakes only read files git is tracking. Install git and run init again.",
    );
  }
}

async function trackEveryFile(directory) {
  await run("git", ["add", "."], { cwd: directory, capture: true });
}

export async function initialiseConfiguration({ directory, assumeYes, template }) {
  const targetDirectory = resolve(directory ?? process.cwd());
  if (existsSync(join(targetDirectory, "flake.nix"))) {
    throw new UserFacingError(
      `${targetDirectory} already holds a flake.nix. Edit tackroom.nix there, or pick an empty directory.`,
    );
  }

  const nixPath = await requireNix({ assumeYes });

  step(`Scaffolding a configuration in ${bold(targetDirectory)}`);
  const scaffold = await nix(nixPath, ["flake", "init", "-t", template ?? DEFAULT_TEMPLATE], {
    cwd: targetDirectory,
    capture: true,
  });
  if (scaffold.code !== 0) {
    throw new UserFacingError(`Could not fetch the tackroom template.\n${scaffold.stderr.trim()}`);
  }

  const identity = {
    username: userInfo().username,
    homeDirectory: homedir(),
    system: currentNixSystem(),
  };
  await writeFile(join(targetDirectory, "identity.nix"), identityFile(identity), "utf8");
  ok(`identity.nix records ${identity.username} on ${identity.system}`);

  await ensureGitRepository(targetDirectory);
  await trackEveryFile(targetDirectory);
  ok("git is tracking the configuration, so the flake can see every file");

  note("");
  note(`Edit ${join(targetDirectory, "tackroom.nix")} to choose harnesses and what they load.`);
  note(`Edit ${join(targetDirectory, "instructions", "AGENTS.md")} for the rules every agent loads.`);
  note("");

  const editedRules = await readFile(join(targetDirectory, "tackroom.nix"), "utf8");
  if (!editedRules.includes("tackroom")) {
    throw new UserFacingError("The scaffolded tackroom.nix looks wrong; report this as a bug.");
  }

  if (await confirm("Apply this configuration now?", assumeYes)) {
    await applyConfiguration({ directory: targetDirectory, assumeYes });
  } else {
    note("Run `npx tackroom apply` when you are ready.");
  }
}
