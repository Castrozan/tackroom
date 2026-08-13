#!/usr/bin/env node
import { applyConfiguration, updateConfiguration } from "../src/apply.mjs";
import { diagnose } from "../src/doctor.mjs";
import { initialiseConfiguration } from "../src/init.mjs";
import { UserFacingError, bold, red } from "../src/ui.mjs";

const USAGE = `${bold("tackroom")} - declare your agent harness setup once, apply it anywhere

  npx tackroom init [dir]    Scaffold a configuration repository and apply it
  npx tackroom apply [dir]   Build and activate the configuration in dir
  npx tackroom update [dir]  Update pinned inputs, then apply
  npx tackroom doctor [dir]  Report what is wired, what is missing, what is stale

Options
  --yes    Answer every prompt with yes, including the Nix installation prompt
  --template REF   Scaffold from a different flake template (init only)

dir defaults to the current directory.
`;

function parseArguments(argv) {
  const positional = [];
  const options = { assumeYes: false, template: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--yes" || argument === "-y") options.assumeYes = true;
    else if (argument === "--template") {
      index += 1;
      options.template = argv[index];
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else positional.push(argument);
  }
  return { command: positional[0], directory: positional[1], options };
}

const COMMANDS = {
  init: (directory, options) =>
    initialiseConfiguration({ directory, assumeYes: options.assumeYes, template: options.template }),
  apply: (directory, options) => applyConfiguration({ directory, assumeYes: options.assumeYes }),
  update: (directory, options) => updateConfiguration({ directory, assumeYes: options.assumeYes }),
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
