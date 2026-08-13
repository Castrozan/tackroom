import { spawn } from "node:child_process";

const preToolUseDispatcher = "@preToolUseDispatcher@";

function runDispatcher(payload) {
  return new Promise((resolve) => {
    const dispatcher = spawn(preToolUseDispatcher, {
      stdio: ["pipe", "pipe", "inherit"],
    });
    let stdout = "";
    dispatcher.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    dispatcher.on("error", () => resolve(""));
    dispatcher.on("close", () => resolve(stdout));
    dispatcher.stdin.on("error", () => {});
    dispatcher.stdin.end(JSON.stringify(payload));
  });
}

function denialReason(dispatcherOutput) {
  const trimmed = (dispatcherOutput || "").trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const decision = parsed?.hookSpecificOutput;
  if (decision?.permissionDecision !== "deny") return null;
  return decision.permissionDecisionReason || "Blocked by tackroom.";
}

export const TackroomGuards = async ({ directory } = {}) => {
  const workingDirectory = typeof directory === "string" && directory ? directory : process.cwd();
  return {
    "tool.execute.before": async (input, output) => {
      const dispatcherOutput = await runDispatcher({
        hook_event_name: "PreToolUse",
        tool_name: input?.tool ?? "",
        tool_input: output?.args ?? {},
        session_id: input?.sessionID ?? "",
        cwd: workingDirectory,
      });
      const reason = denialReason(dispatcherOutput);
      if (reason) throw new Error(reason);
    },
  };
};
