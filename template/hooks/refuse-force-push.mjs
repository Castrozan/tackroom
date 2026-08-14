#!/usr/bin/env node
import { stdin } from "node:process";

const FORBIDDEN = /git\s+push\b[^|;&]*(--force(?!-with-lease)|(?:^|\s)-f(?:\s|$))/;
const PAYLOAD_TIMEOUT_MS = 1000;

function readPayload() {
  if (stdin.isTTY) return Promise.resolve("");
  return Promise.race([
    new Promise((resolve) => {
      let buffer = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => {
        buffer += chunk;
      });
      stdin.on("end", () => resolve(buffer));
      stdin.on("error", () => resolve(""));
    }),
    new Promise((resolve) => setTimeout(() => resolve(""), PAYLOAD_TIMEOUT_MS).unref()),
  ]);
}

function refuse(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

let payload = {};
try {
  payload = JSON.parse(await readPayload());
} catch {
  payload = {};
}

const command = payload?.tool_input?.command ?? "";

if (FORBIDDEN.test(command)) {
  refuse(
    "A force push rewrites history other people may have pulled. Use --force-with-lease, or push a new branch.",
  );
}

process.exit(0);
