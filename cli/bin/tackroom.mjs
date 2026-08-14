#!/usr/bin/env node
import { applyConfiguration } from "../src/apply.mjs";
import { diagnose } from "../src/doctor.mjs";
import { initialiseConfiguration } from "../src/init.mjs";
import { UserFacingError, bold, red } from "../src/ui.mjs";

const USAGE = `${bold("tackroom")} - declare your agent harness setup once, apply it anywhere

  npx tackroom init [dir]    Scaffold a configuration and apply it
  npx tackroom apply [dir]   Project the configuration onto every declared harness
  npx tackroom doctor [dir]  Report what is declared, what is deployed, what is stale

Options
  --yes, -y   Answer every prompt with yes

dir defaults to the current directory.
`;

function parseArguments(argv) {
  const positional = [];
  const options = { assumeYes: false, help: false };
  for (const argument of argv) {
    if (argument === "--yes" || argument === "-y") options.assumeYes = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else positional.push(argument);
  }
  return { command: positional[0], directory: positional[1], options };
}

const COMMANDS = {
  init: (directory, options) => initialiseConfiguration({ directory, assumeYes: options.assumeYes }),
  apply: (directory) => applyConfiguration({ directory }),
  doctor: (directory) => diagnose({ directory }),
};

async function main() {
  const { command, directory, options } = parseArguments(process.argv.slice(2));
  if (options.help || !command) {
    console.log(USAGE);
    return;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`${red("Unknown command")} ${command}\n`);
    console.log(USAGE);
    process.exitCode = 2;
    return;
  }
  await handler(directory, options);
}

main().catch((error) => {
  if (error instanceof UserFacingError) {
    console.error(`\n${red("tackroom")} ${error.message}`);
    process.exitCode = 1;
    return;
  }
  throw error;
});
