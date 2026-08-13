{
  self,
  nixpkgs,
  lib,
  forAllSystems,
}:
forAllSystems (
  system:
  let
    pkgs = nixpkgs.legacyPackages.${system};

    evaluation = import ./evaluate.nix {
      inherit pkgs lib;
      module = self.homeManagerModules.tackroom;
    };
    inherit (evaluation)
      evaluateTackroom
      projectionOf
      deployedFileNames
      activationStepNames
      unmetAssertions
      ;

    everyHarnessEnabled = {
      tackroom = {
        enable = true;
        instructions = ../template/instructions/AGENTS.md;
        skillsDirectory = ../template/skills;
        subagentsDirectory = ../template/subagents;
        guardrails.blockedCommands = [
          {
            pattern = "\\bgit\\s+add\\s+-A\\b";
            reason = "Stage specific files.";
          }
        ];
        guardrails.protectedPaths = [ "~/.ssh" ];
        harnesses = {
          claude.enable = true;
          codex.enable = true;
          opencode.enable = true;
        };
      };
    };

    evaluated = evaluateTackroom everyHarnessEnabled;
    projection = projectionOf evaluated;

    withCodexSuffix = projectionOf (
      evaluateTackroom (
        lib.recursiveUpdate everyHarnessEnabled {
          tackroom.harnesses.codex.instructionsSuffix = "Codex reaches the shell differently.";
        }
      )
    );

    nothingDeclared = evaluateTackroom {
      tackroom.enable = true;
      tackroom.harnesses.claude.enable = true;
    };

    deployedNames = deployedFileNames evaluated;

    instructionPaths = [
      ".claude/CLAUDE.md"
      ".codex/AGENTS.md"
      ".config/opencode/AGENTS.md"
    ];

    skillPaths = [
      ".claude/skills"
      ".agents/skills"
      ".config/opencode/skills"
    ];

    mkEvalCheck =
      name: assertion: message:
      if assertion then
        pkgs.runCommandLocal "check-${name}" { } "touch $out"
      else
        builtins.throw "CHECK FAILED [${name}]: ${message}";

    mkBuiltCheck =
      name: script:
      pkgs.runCommandLocal "check-${name}" { } ''
        fail() {
          echo "CHECK FAILED [${name}]: $1" >&2
          exit 1
        }
        ${script}
        touch $out
      '';
  in
  {
    instructions-reach-every-harness-identically = mkBuiltCheck "instructions-reach-every-harness-identically" ''
      reference=""
      for path in ${lib.escapeShellArgs instructionPaths}; do
        [ -f "${projection}/$path" ] || fail "$path was never projected"
        if [ -z "$reference" ]; then
          reference="${projection}/$path"
        elif ! cmp -s "$reference" "${projection}/$path"; then
          fail "$path differs from $reference, so a rule written once applies unevenly"
        fi
      done
    '';

    a-harness-suffix-changes-only-that-harness = mkBuiltCheck "a-harness-suffix-changes-only-that-harness" ''
      cmp -s "${projection}/.codex/AGENTS.md" "${withCodexSuffix}/.codex/AGENTS.md" &&
        fail "a codex suffix must change the codex instructions"
      cmp -s "${projection}/.claude/CLAUDE.md" "${withCodexSuffix}/.claude/CLAUDE.md" ||
        fail "a codex suffix must not reach Claude Code"
    '';

    every-skill-reaches-every-harness = mkBuiltCheck "every-skill-reaches-every-harness" ''
      for path in ${lib.escapeShellArgs skillPaths}; do
        [ -f "${projection}/$path/commit/SKILL.md" ] ||
          fail "the commit skill never reached $path"
      done
    '';

    subagents-reach-every-harness = mkBuiltCheck "subagents-reach-every-harness" ''
      [ -f "${projection}/.claude/agents/reviewer.md" ] || fail "Claude Code got no subagent"
      [ -f "${projection}/.config/opencode/agents/reviewer.md" ] || fail "OpenCode got no subagent"
      ls "${projection}/.codex/agents/" >/dev/null 2>&1 || fail "Codex got no subagent directory"
      grep -q "mode: subagent" "${projection}/.config/opencode/agents/reviewer.md" ||
        fail "OpenCode subagents must carry its own schema, since it treats an unparseable agent file as fatal"
    '';

    guardrails-are-wired-on-every-harness =
      mkEvalCheck "guardrails-are-wired-on-every-harness"
        (
          builtins.elem "tackroomClaudeGuards" (activationStepNames evaluated)
          && builtins.elem "tackroomCodexGuards" (activationStepNames evaluated)
          && builtins.elem ".config/opencode/plugin/tackroom-guards.js" deployedNames
        )
        ''
          declared guardrails must reach every enabled harness through tackroom's own bridge. The
          engine's OpenCode hook output calls the command with no stdin and ignores its answer, so
          delegating this would leave OpenCode unguarded while the other two looked fine.
        '';

    an-empty-configuration-refuses-to-build =
      mkEvalCheck "an-empty-configuration-refuses-to-build" (unmetAssertions nothingDeclared != [ ])
        "enabling tackroom with nothing declared must fail loudly rather than deploy three empty harnesses";

    unit-tests =
      pkgs.runCommandLocal "tackroom-unit-tests"
        {
          nativeBuildInputs = [
            (pkgs.python312.withPackages (pythonPackages: [
              pythonPackages.pytest
              pythonPackages.tomli-w
            ]))
          ];
        }
        ''
          cp -r ${self} source
          chmod -R u+w source
          cd source
          export HOME="$(mktemp -d)"
          python -m pytest -p no:cacheprovider -q tests
          touch $out
        '';
  }
)
