import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { nix, requireNix, run } from "./nix.mjs";
import { UserFacingError, note, ok, step } from "./ui.mjs";

export function requireConfigurationDirectory(directory) {
  const configurationDirectory = resolve(directory ?? process.cwd());
  if (!existsSync(join(configurationDirectory, "flake.nix"))) {
    throw new UserFacingError(
      `${configurationDirectory} is not a tackroom configuration. Run \`npx tackroom init\` there first.`,
    );
  }
  return configurationDirectory;
}

export async function untrackedFiles(directory) {
  const status = await run("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: directory,
    capture: true,
  });
  if (status.code !== 0) return [];
  return status.stdout
    .split("\n")
    .filter((line) => line.startsWith("??"))
    .map((line) => line.slice(3).trim());
}

export async function applyConfiguration({ directory, assumeYes }) {
  const configurationDirectory = requireConfigurationDirectory(directory);
  const nixPath = await requireNix({ assumeYes });

  const untracked = await untrackedFiles(configurationDirectory);
  if (untracked.length > 0) {
    step("Staging files git was not tracking yet");
    note("A flake reads the git index, so an untracked file is invisible to the build.");
    for (const file of untracked) note(file);
    await run("git", ["add", "."], { cwd: configurationDirectory, capture: true });
  }

  step("Building and activating your configuration");
  const applied = await nix(nixPath, ["run", ".#apply"], { cwd: configurationDirectory });
  if (applied.code !== 0) {
    throw new UserFacingError("Activation failed. The Nix output above names the option or file at fault.");
  }
  ok("Every enabled harness now matches this repository");
}

export async function updateConfiguration({ directory, assumeYes }) {
  const configurationDirectory = requireConfigurationDirectory(directory);
  const nixPath = await requireNix({ assumeYes });

  step("Updating pinned inputs");
  const updated = await nix(nixPath, ["flake", "update"], { cwd: configurationDirectory });
  if (updated.code !== 0) {
    throw new UserFacingError("Could not update the flake inputs. The Nix output above says why.");
  }
  await applyConfiguration({ directory: configurationDirectory, assumeYes });
  note("Commit the updated flake.lock to pin these versions for your other machines.");
}
