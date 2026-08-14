import { existsSync } from "node:fs";
import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyConfiguration } from "./apply.mjs";
import { CONFIGURATION_FILE_NAME } from "./config.mjs";
import { UserFacingError, confirm, note, ok, step } from "./ui.mjs";

const templateDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "template");

async function isEmptyEnough(directory) {
  if (!existsSync(directory)) return true;
  const entries = await readdir(directory);
  return entries.filter((entry) => entry !== ".git").length === 0;
}

export async function initialiseConfiguration({ directory, assumeYes }) {
  const targetDirectory = resolve(directory ?? process.cwd());

  step(`Scaffolding a configuration in ${targetDirectory}`);
  if (existsSync(join(targetDirectory, CONFIGURATION_FILE_NAME))) {
    throw new UserFacingError(
      `${targetDirectory} already holds a ${CONFIGURATION_FILE_NAME}. Edit it, or pick another directory.`,
    );
  }
  if (!(await isEmptyEnough(targetDirectory))) {
    const proceed = await confirm(
      `${targetDirectory} is not empty. Write the scaffold into it anyway?`,
      assumeYes,
    );
    if (!proceed) throw new UserFacingError("Nothing was written.");
  }

  await mkdir(targetDirectory, { recursive: true });
  await cp(templateDirectory, targetDirectory, { recursive: true });
  ok(`${CONFIGURATION_FILE_NAME}, instructions, skills, subagents and a sample hook`);

  note("");
  note(`Edit ${join(targetDirectory, CONFIGURATION_FILE_NAME)} to choose harnesses and what they load.`);
  note(`Edit ${join(targetDirectory, "instructions", "AGENTS.md")} for the rules every agent loads.`);
  note("");

  const proceed = await confirm("Apply this configuration now?", assumeYes);
  if (!proceed) {
    note(`When you are ready, run: npx tackroom apply ${targetDirectory}`);
    return;
  }

  await applyConfiguration({ directory: targetDirectory });
  note("Put this directory under git and push it to carry the setup to another machine.");
}
