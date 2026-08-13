import hook_dispatch


def test_every_harness_shell_tool_arrives_as_one_name():
    for harness_tool_name in ("Bash", "bash", "shell", "local_shell", "terminal"):
        assert (
            hook_dispatch.canonical_tool_name(harness_tool_name)
            == hook_dispatch.RUN_COMMAND_TOOL
        )


def test_every_harness_write_tool_arrives_as_one_name():
    for harness_tool_name in ("Write", "Edit", "edit", "write_file", "apply_patch"):
        assert (
            hook_dispatch.canonical_tool_name(harness_tool_name)
            == hook_dispatch.WRITE_FILE_TOOL
        )


def test_an_unknown_tool_keeps_its_own_name():
    assert hook_dispatch.canonical_tool_name("WebFetch") == "WebFetch"
    assert hook_dispatch.canonical_tool_name(None) == ""


def test_a_command_is_found_whichever_field_carries_it():
    assert hook_dispatch.invoked_command({"command": "ls"}) == "ls"
    assert hook_dispatch.invoked_command({"cmd": "ls -la"}) == "ls -la"
    assert hook_dispatch.invoked_command({"command": ["git", "status"]}) == "git status"
    assert hook_dispatch.invoked_command({}) == ""


def test_a_string_tool_input_is_read_as_a_command():
    assert hook_dispatch.tool_input_of({"tool_input": "rm -rf build"}) == {
        "command": "rm -rf build"
    }


def test_opencode_style_arguments_are_read_as_tool_input():
    assert hook_dispatch.tool_input_of({"args": {"filePath": "/tmp/x"}}) == {
        "filePath": "/tmp/x"
    }
