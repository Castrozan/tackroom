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
      deployedText
      deployedFileNames
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

    withCodexSuffix = evaluateTackroom (
      lib.recursiveUpdate everyHarnessEnabled {
        tackroom.harnesses.codex.instructionsSuffix = "Codex reaches the shell differently.";
      }
    );

    nothingDeclared = evaluateTackroom {
      tackroom.enable = true;
      tackroom.harnesses.claude.enable = true;
    };

    claudeInstructions = deployedText evaluated ".claude/CLAUDE.md";
    codexInstructions = deployedText evaluated ".codex/AGENTS.md";
    opencodeInstructions = deployedText evaluated ".config/opencode/AGENTS.md";
    translatedSubagent = deployedText evaluated ".config/opencode/agent/reviewer.md";

    inherit (evaluated.tackroom.internal) skillNames;
    deployedNames = deployedFileNames evaluated;
    skillReachesEveryHarness =
      skillName:
      builtins.all (prefix: builtins.elem "${prefix}/${skillName}" deployedNames) [
        ".claude/skills"
        ".codex/skills"
        ".config/opencode/skills"
      ];

    mkCheck =
      name: assertion: message:
      if assertion then
        pkgs.runCommandLocal "check-${name}" { } "touch $out"
      else
        builtins.throw "CHECK FAILED [${name}]: ${message}";
  in
  {
    instructions-reach-every-harness-identically =
      mkCheck "instructions-reach-every-harness-identically"
        (claudeInstructions == codexInstructions && codexInstructions == opencodeInstructions)
        "the shared instruction set must arrive byte-identical on all three harnesses, because a rule that silently applies to two of them is worse than no rule";

    a-harness-suffix-changes-only-that-harness = mkCheck "a-harness-suffix-changes-only-that-harness" (
      deployedText withCodexSuffix ".codex/AGENTS.md" != codexInstructions
      && deployedText withCodexSuffix ".claude/CLAUDE.md" == claudeInstructions
    ) "instructionsSuffix must reach its own harness and no other";

    every-skill-reaches-every-harness = mkCheck "every-skill-reaches-every-harness" (
      skillNames != [ ] && builtins.all skillReachesEveryHarness skillNames
    ) "a skill declared once must be deployed into all three harness skill directories";

    guardrails-are-wired-on-every-harness =
      mkCheck "guardrails-are-wired-on-every-harness"
        (
          evaluated.tackroom.declared.claudeSettings ? hooks
          && evaluated.tackroom.declared.codexConfig ? hooks
          && builtins.elem ".config/opencode/plugin/tackroom-guards.js" deployedNames
        )
        "declared guardrails must reach the native hook surface of every enabled harness, otherwise a blocked command is blocked on some CLIs and not others";

    subagents-are-translated-for-opencode =
      mkCheck "subagents-are-translated-for-opencode"
        (
          lib.hasInfix "mode: subagent" translatedSubagent
          && lib.hasInfix "read: true" translatedSubagent
          && lib.hasInfix "write: false" translatedSubagent
          && builtins.elem ".claude/agents/reviewer.md" deployedNames
        )
        "Claude subagent frontmatter must be rewritten into OpenCode's permission-map schema, since OpenCode treats an unreadable agent file as a fatal config error";

    codex-gets-no-subagent-files =
      mkCheck "codex-gets-no-subagent-files"
        (!builtins.any (name: lib.hasPrefix ".codex/agents" name) deployedNames)
        "Codex has no user-defined subagent file format, so writing agent files there would be dead configuration";

    an-empty-configuration-refuses-to-build =
      mkCheck "an-empty-configuration-refuses-to-build" (unmetAssertions nothingDeclared != [ ])
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
