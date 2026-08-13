_: {
  tackroom = {
    enable = true;

    instructions = ./instructions/AGENTS.md;
    skillsDirectory = ./skills;
    subagentsDirectory = ./subagents;

    harnesses.claude.enable = true;
    harnesses.codex.enable = false;
    harnesses.opencode.enable = false;

    guardrails = {
      blockedCommands = [
        {
          pattern = "\\bgit\\s+add\\s+(-A\\b|--all\\b|\\.(\\s|$))";
          reason = "Stage the files you changed by name; a blanket add sweeps in unrelated work.";
        }
        {
          pattern = "\\bgit\\s+(push|commit)\\b[^|;&]*--no-verify\\b";
          reason = "The pre-commit hooks are the gate; fix what they report instead of skipping them.";
        }
        {
          pattern = "\\brm\\s+(-[a-zA-Z]*f[a-zA-Z]*\\s+)*-{0,2}[a-zA-Z]*\\s*/(\\s|$)";
          reason = "Deleting from the filesystem root is never the task; name the directory you mean.";
        }
      ];

      protectedPaths = [
        "~/.ssh"
        "~/.gnupg"
        "~/.aws"
      ];
    };
  };
}
