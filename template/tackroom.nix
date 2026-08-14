_: {
  tackroom = {
    enable = true;

    instructions = ./instructions/AGENTS.md;
    skillsDirectory = ./skills;
    subagentsDirectory = ./subagents;

    harnesses.claude.enable = true;
    harnesses.codex.enable = false;
    harnesses.opencode.enable = false;

  };
}
