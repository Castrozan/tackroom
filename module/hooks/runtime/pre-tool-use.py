#!/usr/bin/env python3
"""PreToolUse entry point. Every harness reaches the same guards through here."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))

import blocked_command_guard  # noqa: E402
import protected_path_guard  # noqa: E402
from hook_dispatch import emit_pre_tool_use_decision, read_hook_input, run_guards  # noqa: E402

GUARDS = [
    blocked_command_guard.guard,
    protected_path_guard.guard,
]


def main():
    hook_input = read_hook_input()
    if hook_input is None:
        return
    emit_pre_tool_use_decision(run_guards(hook_input, GUARDS))


if __name__ == "__main__":
    main()
