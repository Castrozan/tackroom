import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { UserFacingError, confirm, note, step } from "./ui.mjs";

const KNOWN_NIX_LOCATIONS = [
  "/nix/var/nix/profiles/default/bin/nix",
  "/run/current-system/sw/bin/nix",
  "/usr/local/bin/nix",
];

const FLAKE_FEATURE_FLAGS = ["--extra-experimental-features", "nix-command flakes"];

const NIX_INSTALLER =
  "curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install --no-confirm";

export function run(command, commandArguments, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArguments, {
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: options.shell ?? false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: 127, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function locateNix() {
  const onPath = await run("sh", ["-c", "command -v nix"], { capture: true });
  if (onPath.code === 0 && onPath.stdout.trim()) return onPath.stdout.trim();
  return KNOWN_NIX_LOCATIONS.find((location) => existsSync(location)) ?? null;
}

export async function requireNix({ assumeYes }) {
  const located = await locateNix();
  if (located) return located;

  step("Nix is not installed");
  note("tackroom builds your configuration with Nix. The Determinate Systems installer sets it");
  note("up with flakes enabled and ships a documented uninstaller.");
  note(NIX_INSTALLER);
  if (!(await confirm("Install Nix now?", assumeYes))) {
    throw new UserFacingError(
      "Nix is required. Install it yourself and run this command again, or re-run with --yes.",
    );
  }

  const installation = await run("sh", ["-c", NIX_INSTALLER], { shell: false });
  if (installation.code !== 0) {
    throw new UserFacingError("The Nix installer did not finish. Read its output above and retry.");
  }

  const installed = await locateNix();
  if (!installed) {
    throw new UserFacingError(
      "Nix installed but is not on this shell's PATH yet. Open a new terminal and run this command again.",
    );
  }
  return installed;
}

export async function nix(nixPath, nixArguments, options = {}) {
  return run(nixPath, [...FLAKE_FEATURE_FLAGS, ...nixArguments], options);
}

export function currentNixSystem() {
  const architecture = process.arch === "arm64" ? "aarch64" : "x86_64";
  const kernel = process.platform === "darwin" ? "darwin" : "linux";
  return `${architecture}-${kernel}`;
}
