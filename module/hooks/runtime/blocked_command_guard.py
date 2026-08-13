"""Refuse the commands the configuration says no agent may run on this machine."""

import re

from hook_dispatch import RUN_COMMAND_TOOL, Denial, invoked_command

REFUSAL_TEMPLATE = "Blocked by tackroom: {reason}\nCommand: {command}"


def compiled_rules(guardrails):
    rules = []
    for rule in guardrails.get("blockedCommands", []):
        if not isinstance(rule, dict):
            continue
        pattern = rule.get("pattern")
        if not isinstance(pattern, str) or not pattern:
            continue
        try:
            rules.append(
                (
                    re.compile(pattern),
                    rule.get("reason", "this command is not allowed here"),
                )
            )
        except re.error:
            continue
    return rules


def guard(tool_name, tool_input, guardrails, **_unused):
    if tool_name != RUN_COMMAND_TOOL:
        return None
    command = invoked_command(tool_input)
    if not command:
        return None
    for pattern, reason in compiled_rules(guardrails):
        if pattern.search(command):
            return Denial(
                REFUSAL_TEMPLATE.format(reason=reason, command=command.strip())
            )
    return None
