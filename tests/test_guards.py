import blocked_command_guard
import protected_path_guard
from hook_dispatch import RUN_COMMAND_TOOL, WRITE_FILE_TOOL

BLOCKED_GIT_ADD = {
    "blockedCommands": [
        {"pattern": r"\bgit\s+add\s+-A\b", "reason": "Stage specific files."},
    ]
}


def test_a_blocked_command_is_refused_with_the_declared_reason():
    denial = blocked_command_guard.guard(
        tool_name=RUN_COMMAND_TOOL,
        tool_input={"command": "git add -A && git commit"},
        guardrails=BLOCKED_GIT_ADD,
    )

    assert denial is not None
    assert "Stage specific files." in denial.reason
    assert "git add -A && git commit" in denial.reason


def test_a_command_that_matches_nothing_passes():
    assert (
        blocked_command_guard.guard(
            tool_name=RUN_COMMAND_TOOL,
            tool_input={"command": "git add module/options.nix"},
            guardrails=BLOCKED_GIT_ADD,
        )
        is None
    )


def test_a_write_is_never_judged_by_the_command_guard():
    assert (
        blocked_command_guard.guard(
            tool_name=WRITE_FILE_TOOL,
            tool_input={"command": "git add -A"},
            guardrails=BLOCKED_GIT_ADD,
        )
        is None
    )


def test_an_unparseable_pattern_is_skipped_rather_than_crashing_the_hook():
    assert (
        blocked_command_guard.guard(
            tool_name=RUN_COMMAND_TOOL,
            tool_input={"command": "anything"},
            guardrails={"blockedCommands": [{"pattern": "([unclosed", "reason": "x"}]},
        )
        is None
    )


def test_a_write_inside_a_protected_path_is_refused(tmp_path):
    protected = tmp_path / "secrets"
    denial = protected_path_guard.guard(
        tool_name=WRITE_FILE_TOOL,
        tool_input={"file_path": str(protected / "id_ed25519")},
        guardrails={"protectedPaths": [str(protected)]},
    )

    assert denial is not None
    assert str(protected) in denial.reason


def test_a_sibling_of_a_protected_path_is_not_refused(tmp_path):
    assert (
        protected_path_guard.guard(
            tool_name=WRITE_FILE_TOOL,
            tool_input={"file_path": str(tmp_path / "secrets-notes.md")},
            guardrails={"protectedPaths": [str(tmp_path / "secrets")]},
        )
        is None
    )


def test_an_opencode_style_write_payload_is_understood(tmp_path):
    protected = tmp_path / "keys"
    denial = protected_path_guard.guard(
        tool_name=WRITE_FILE_TOOL,
        tool_input={"filePath": str(protected / "key")},
        guardrails={"protectedPaths": [str(protected)]},
    )

    assert denial is not None
