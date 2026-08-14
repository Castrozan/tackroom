import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseJsonc } from "./jsonc.mjs";
import { UserFacingError } from "./ui.mjs";

export const CONFIGURATION_FILE_NAME = "tackroom.jsonc";

export const HARNESSES = {
  claude: { displayName: "Claude Code", engineTarget: "claudecode" },
  codex: { displayName: "Codex", engineTarget: "codexcli" },
  opencode: { displayName: "OpenCode", engineTarget: "opencode" },
};

const KNOWN_KEYS = new Set([
  "harnesses",
  "instructions",
  "instructionsSuffix",
  "skills",
  "subagents",
  "hooks",
  "mcpServers",
]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateHarnesses(declared, problems) {
  if (declared === undefined) return Object.keys(HARNESSES);
  if (!Array.isArray(declared) || declared.some((name) => typeof name !== "string")) {
    problems.push("harnesses must be a list of harness names");
    return [];
  }
  const unknown = declared.filter((name) => !Object.hasOwn(HARNESSES, name));
  if (unknown.length > 0) {
    problems.push(`unknown harness ${unknown.join(", ")}; known are ${Object.keys(HARNESSES).join(", ")}`);
  }
  return declared.filter((name) => Object.hasOwn(HARNESSES, name));
}

function validateSuffixes(declared, harnesses, problems) {
  if (declared === undefined) return {};
  if (!isPlainObject(declared)) {
    problems.push("instructionsSuffix must be an object keyed by harness name");
    return {};
  }
  for (const [name, suffix] of Object.entries(declared)) {
    if (!Object.hasOwn(HARNESSES, name)) problems.push(`instructionsSuffix names unknown harness ${name}`);
    else if (typeof suffix !== "string") problems.push(`instructionsSuffix.${name} must be a string`);
    else if (!harnesses.includes(name)) {
      problems.push(
        `instructionsSuffix.${name} is set but ${name} is not in harnesses, so it would reach nothing`,
      );
    }
  }
  return declared;
}

function validateHooks(declared, root, problems) {
  if (declared === undefined) return {};
  if (!isPlainObject(declared)) {
    problems.push("hooks must be an object keyed by event name");
    return {};
  }

  const resolved = {};
  for (const [event, definitions] of Object.entries(declared)) {
    if (!Array.isArray(definitions)) {
      problems.push(`hooks.${event} must be a list of hook definitions`);
      continue;
    }
    resolved[event] = definitions.map((definition, position) => {
      const where = `hooks.${event}[${position}]`;
      if (!isPlainObject(definition)) {
        problems.push(`${where} must be an object with a command`);
        return definition;
      }
      if (typeof definition.command !== "string" || definition.command === "") {
        problems.push(`${where} needs a command`);
        return definition;
      }
      const command = resolveHookCommand(definition.command, root, where, problems);
      return { ...definition, command };
    });
  }
  return resolved;
}

function resolveHookCommand(command, root, where, problems) {
  const [executable, ...rest] = command.split(" ");
  if (!executable.startsWith("./") && !executable.startsWith("../")) return command;

  const absolute = resolve(root, executable);
  if (!existsSync(absolute)) {
    problems.push(`${where} points at ${executable}, which does not exist in this configuration`);
  }
  return [absolute, ...rest].join(" ");
}

function validateMcpServers(declared, problems) {
  if (declared === undefined) return {};
  if (!isPlainObject(declared)) {
    problems.push("mcpServers must be an object keyed by server name");
    return {};
  }
  for (const [name, server] of Object.entries(declared)) {
    if (!isPlainObject(server) || typeof server.command !== "string") {
      problems.push(`mcpServers.${name} needs a command`);
    }
  }
  return declared;
}

function validatePath(declared, root, key, problems) {
  if (declared === undefined || declared === null) return null;
  if (typeof declared !== "string") {
    problems.push(`${key} must be a path relative to the configuration directory`);
    return null;
  }
  if (isAbsolute(declared)) {
    problems.push(`${key} must be relative to the configuration directory, so the repository stays portable`);
    return null;
  }
  const absolute = resolve(root, declared);
  if (!existsSync(absolute)) {
    problems.push(`${key} points at ${declared}, which does not exist`);
    return null;
  }
  return absolute;
}

export function parseConfiguration(text, root) {
  let declared;
  try {
    declared = parseJsonc(text);
  } catch (error) {
    throw new UserFacingError(`${CONFIGURATION_FILE_NAME} is not valid JSON: ${error.message}`);
  }

  if (!isPlainObject(declared)) {
    throw new UserFacingError(`${CONFIGURATION_FILE_NAME} must contain a JSON object`);
  }

  const problems = [];
  for (const key of Object.keys(declared)) {
    if (!KNOWN_KEYS.has(key)) {
      problems.push(`unknown key ${key}; known are ${[...KNOWN_KEYS].join(", ")}`);
    }
  }

  const harnesses = validateHarnesses(declared.harnesses, problems);
  const configuration = {
    root,
    harnesses,
    instructions: validatePath(declared.instructions, root, "instructions", problems),
    instructionsSuffix: validateSuffixes(declared.instructionsSuffix, harnesses, problems),
    skills: validatePath(declared.skills, root, "skills", problems),
    subagents: validatePath(declared.subagents, root, "subagents", problems),
    hooks: validateHooks(declared.hooks, root, problems),
    mcpServers: validateMcpServers(declared.mcpServers, problems),
  };

  if (harnesses.length === 0 && problems.length === 0) {
    problems.push("harnesses is empty, so there is nothing to configure");
  }

  const declaresSomething =
    configuration.instructions !== null ||
    configuration.skills !== null ||
    configuration.subagents !== null ||
    Object.keys(configuration.hooks).length > 0 ||
    Object.keys(configuration.mcpServers).length > 0;

  if (!declaresSomething && problems.length === 0) {
    problems.push("nothing is declared, so applying would deploy empty harnesses");
  }

  return { configuration, problems };
}

export async function loadConfiguration(directory) {
  const root = resolve(directory ?? process.cwd());
  const path = join(root, CONFIGURATION_FILE_NAME);
  if (!existsSync(path)) {
    throw new UserFacingError(
      `${root} holds no ${CONFIGURATION_FILE_NAME}. Run \`npx tackroom init\` there first.`,
    );
  }

  const { configuration, problems } = parseConfiguration(await readFile(path, "utf8"), root);
  if (problems.length > 0) {
    throw new UserFacingError(
      `${CONFIGURATION_FILE_NAME} has ${problems.length === 1 ? "a problem" : "problems"}:\n  ${problems.join("\n  ")}`,
    );
  }
  return configuration;
}
