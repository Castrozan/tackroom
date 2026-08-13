"""Refuse writes that land inside a path the configuration marks off limits."""

import os

from hook_dispatch import WRITE_FILE_TOOL, Denial, targeted_file_path

REFUSAL_TEMPLATE = (
    "Blocked by tackroom: {path} is inside the protected path {protected}. "
    "Nothing under it may be written by an agent."
)


def protected_prefixes(guardrails):
    prefixes = []
    for protected in guardrails.get("protectedPaths", []):
        if isinstance(protected, str) and protected:
            prefixes.append(os.path.abspath(os.path.expanduser(protected)))
    return prefixes


def path_is_inside(candidate, directory):
    return candidate == directory or candidate.startswith(
        directory.rstrip(os.sep) + os.sep
    )


def guard(tool_name, tool_input, guardrails, **_unused):
    if tool_name != WRITE_FILE_TOOL:
        return None
    target = targeted_file_path(tool_input)
    if not target:
        return None
    for protected in protected_prefixes(guardrails):
        if path_is_inside(target, protected):
            return Denial(REFUSAL_TEMPLATE.format(path=target, protected=protected))
    return None
