import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HARNESSES } from "./config.mjs";

async function readInstructions(configuration) {
  if (configuration.instructions === null) return "";
  return (await readFile(configuration.instructions, "utf8")).trim();
}

function ruleFor(harness, body, suffix) {
  const frontmatter = [
    "---",
    "root: true",
    `targets: ["${HARNESSES[harness].engineTarget}"]`,
    'description: "Instructions tackroom declares for every agent on this machine"',
    "---",
    "",
  ].join("\n");
  const trimmedSuffix = (suffix ?? "").trim();
  const content = trimmedSuffix === "" ? body : `${body}\n\n${trimmedSuffix}`;
  return `${frontmatter}\n${content}\n`;
}

export function declaredFeatures(configuration) {
  const features = [];
  if (configuration.instructions !== null) features.push("rules");
  if (configuration.skills !== null) features.push("skills");
  if (configuration.subagents !== null) features.push("subagents");
  if (Object.keys(configuration.mcpServers).length > 0) features.push("mcp");
  if (Object.keys(configuration.hooks).length > 0) features.push("hooks");
  return features;
}

export async function renderSource(configuration, destination) {
  const rulesyncDirectory = join(destination, ".rulesync");
  await mkdir(rulesyncDirectory, { recursive: true });

  const body = await readInstructions(configuration);
  if (configuration.instructions !== null) {
    await mkdir(join(rulesyncDirectory, "rules"), { recursive: true });
    for (const harness of configuration.harnesses) {
      await writeFile(
        join(rulesyncDirectory, "rules", `${harness}.md`),
        ruleFor(harness, body, configuration.instructionsSuffix[harness]),
        "utf8",
      );
    }
  }

  if (configuration.skills !== null) {
    await cp(configuration.skills, join(rulesyncDirectory, "skills"), { recursive: true });
  }

  if (configuration.subagents !== null) {
    await cp(configuration.subagents, join(rulesyncDirectory, "subagents"), { recursive: true });
  }

  if (Object.keys(configuration.mcpServers).length > 0) {
    const servers = Object.fromEntries(
      Object.entries(configuration.mcpServers).map(([name, server]) => [
        name,
        { type: "stdio", command: server.command, args: server.args ?? [], env: server.env ?? {} },
      ]),
    );
    await writeFile(
      join(rulesyncDirectory, "mcp.jsonc"),
      `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`,
      "utf8",
    );
  }

  if (Object.keys(configuration.hooks).length > 0) {
    await writeFile(
      join(rulesyncDirectory, "hooks.jsonc"),
      `${JSON.stringify({ hooks: configuration.hooks }, null, 2)}\n`,
      "utf8",
    );
  }

  await writeFile(
    join(destination, "rulesync.jsonc"),
    `${JSON.stringify(
      {
        targets: configuration.harnesses.map((harness) => HARNESSES[harness].engineTarget),
        features: declaredFeatures(configuration),
        global: true,
        delete: true,
        silent: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return destination;
}
