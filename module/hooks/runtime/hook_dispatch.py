"""Shared plumbing every tackroom hook runs through.

The three harnesses disagree about tool names, payload shapes and how a refusal is
expressed. Every difference is absorbed here so a guard is written once, against one
vocabulary, and stays correct on all three.
"""

import json
import os
import sys

CLAUDE_SURFACE = "claude"
CODEX_SURFACE = "codex"
OPENCODE_SURFACE = "opencode"
EVERY_SURFACE = (CLAUDE_SURFACE, CODEX_SURFACE, OPENCODE_SURFACE)
SURFACE_ARGUMENT_PREFIX = "--surface="

GUARDRAILS_ENVIRONMENT_VARIABLE = "TACKROOM_GUARDRAILS"

RUN_COMMAND_TOOL = "RunCommand"
WRITE_FILE_TOOL = "WriteFile"

TOOL_NAME_ALIASES = {
    "bash": RUN_COMMAND_TOOL,
    "shell": RUN_COMMAND_TOOL,
    "local_shell": RUN_COMMAND_TOOL,
    "exec_command": RUN_COMMAND_TOOL,
    "terminal": RUN_COMMAND_TOOL,
    "write": WRITE_FILE_TOOL,
    "edit": WRITE_FILE_TOOL,
    "multiedit": WRITE_FILE_TOOL,
    "write_file": WRITE_FILE_TOOL,
    "edit_file": WRITE_FILE_TOOL,
    "apply_patch": WRITE_FILE_TOOL,
    "patch": WRITE_FILE_TOOL,
}

COMMAND_FIELDS = ("command", "cmd", "script")
FILE_PATH_FIELDS = ("file_path", "filePath", "path", "target_file")


def requested_surface():
    for argument in sys.argv[1:]:
        if argument.startswith(SURFACE_ARGUMENT_PREFIX):
            return argument[len(SURFACE_ARGUMENT_PREFIX) :]
    return CLAUDE_SURFACE


def read_hook_input():
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def load_guardrails():
    guardrails_path = os.environ.get(GUARDRAILS_ENVIRONMENT_VARIABLE, "")
    if not guardrails_path:
        return {}
    try:
        with open(guardrails_path, encoding="utf-8") as guardrails_file:
            guardrails = json.load(guardrails_file)
    except (OSError, json.JSONDecodeError):
        return {}
    return guardrails if isinstance(guardrails, dict) else {}


def canonical_tool_name(tool_name):
    if not isinstance(tool_name, str):
        return ""
    return TOOL_NAME_ALIASES.get(tool_name.lower(), tool_name)


def tool_input_of(hook_input):
    tool_input = hook_input.get("tool_input")
    if isinstance(tool_input, dict):
        return tool_input
    if isinstance(tool_input, str):
        return {"command": tool_input}
    arguments = hook_input.get("args")
    return arguments if isinstance(arguments, dict) else {}


def invoked_command(tool_input):
    for field in COMMAND_FIELDS:
        value = tool_input.get(field)
        if isinstance(value, str) and value.strip():
            return value
        if isinstance(value, list) and value:
            return " ".join(str(element) for element in value)
    return ""


def targeted_file_path(tool_input):
    for field in FILE_PATH_FIELDS:
        value = tool_input.get(field)
        if isinstance(value, str) and value.strip():
            return os.path.abspath(os.path.expanduser(value))
    return ""


class Denial:
    def __init__(self, reason):
        self.reason = reason


def run_guards(hook_input, guards):
    surface = requested_surface()
    guardrails = load_guardrails()
    tool_name = canonical_tool_name(hook_input.get("tool_name"))
    tool_input = tool_input_of(hook_input)
    for guard in guards:
        denial = guard(
            tool_name=tool_name,
            tool_input=tool_input,
            guardrails=guardrails,
            surface=surface,
            hook_input=hook_input,
        )
        if denial is not None:
            return denial
    return None


def emit_pre_tool_use_decision(denial):
    if denial is None:
        return
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": denial.reason,
                }
            }
        )
    )
