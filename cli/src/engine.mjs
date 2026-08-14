import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { UserFacingError } from "./ui.mjs";

const require = createRequire(import.meta.url);

export function run(command, args, { cwd, env, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function engineRoot() {
  let candidate;
  try {
    candidate = dirname(require.resolve("rulesync"));
  } catch {
    throw new UserFacingError(
      "The rulesync engine is missing. Reinstall tackroom, or run `npm install` if you cloned this repository.",
    );
  }

  while (candidate !== dirname(candidate)) {
    const manifest = join(candidate, "package.json");
    if (existsSync(manifest)) {
      const { name, bin } = JSON.parse(readFileSync(manifest, "utf8"));
      if (name === "rulesync") return { root: candidate, bin: typeof bin === "string" ? bin : bin?.rulesync };
    }
    candidate = dirname(candidate);
  }

  throw new UserFacingError(
    "Found the rulesync module but not its package root, so its CLI cannot be located.",
  );
}

export function enginePath() {
  const { root, bin } = engineRoot();
  const entry = join(root, bin ?? join("dist", "cli", "index.js"));
  if (!existsSync(entry)) {
    throw new UserFacingError(`The rulesync engine is installed but ${entry} is missing.`);
  }
  return entry;
}

export function engineVersion() {
  const { root } = engineRoot();
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
}

export async function generate({ sourceRoot, home, capture = false }) {
  const result = await run(
    process.execPath,
    [
      enginePath(),
      "generate",
      "--global",
      "--input-root",
      sourceRoot,
      "--config",
      join(sourceRoot, "rulesync.jsonc"),
    ],
    { cwd: sourceRoot, env: home ? { HOME: home } : undefined, capture },
  );

  if (result.code !== 0) {
    throw new UserFacingError(
      `The engine refused this configuration.\n${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  return result;
}
