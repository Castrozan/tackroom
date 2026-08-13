{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  tackroomLib = import ./lib { inherit lib; };

  instructionsBody = tackroomLib.readInstructions cfg.instructions;

  skillNames = tackroomLib.skillNamesIn cfg.skillsDirectory;
  subagentFileNames = tackroomLib.markdownFileNamesIn cfg.subagentsDirectory;

  hooks = import ./hooks {
    inherit pkgs lib;
    guardrails = {
      blockedCommands = map (rule: {
        inherit (rule) pattern reason;
      }) cfg.guardrails.blockedCommands;
      protectedPaths = map (tackroomLib.expandHome config.home.homeDirectory) cfg.guardrails.protectedPaths;
    };
  };

  configMergerPython = pkgs.python312.withPackages (pythonPackages: [ pythonPackages.tomli-w ]);

  mergeManagedConfig =
    {
      managedSource,
      liveTarget,
      documentFormat,
    }:
    {
      after = [
        "writeBoundary"
        "linkGeneration"
      ];
      before = [ ];
      data = ''
        export TACKROOM_MANAGED_SOURCE=${lib.escapeShellArg "${managedSource}"}
        export TACKROOM_LIVE_TARGET=${lib.escapeShellArg liveTarget}
        export TACKROOM_FORMAT=${documentFormat}
        ${configMergerPython}/bin/python3 ${./scripts/merge_managed_config.py}
      '';
    };

  instructionsFor =
    harness:
    let
      suffix = cfg.harnesses.${harness}.instructionsSuffix;
    in
    if suffix == "" then instructionsBody else instructionsBody + "\n\n" + suffix;

  skillFilesUnder =
    deploymentPrefix:
    builtins.listToAttrs (
      map (skillName: {
        name = "${deploymentPrefix}/${skillName}";
        value = {
          source = cfg.skillsDirectory + "/${skillName}";
          recursive = true;
        };
      }) skillNames
    );

  enabledHarnessNames = builtins.filter (harness: cfg.harnesses.${harness}.enable) [
    "claude"
    "codex"
    "opencode"
  ];
in
{
  config = lib.mkIf cfg.enable {
    tackroom.internal = {
      inherit
        hooks
        instructionsBody
        instructionsFor
        mergeManagedConfig
        skillFilesUnder
        skillNames
        subagentFileNames
        tackroomLib
        enabledHarnessNames
        ;
    };

    assertions = [
      {
        assertion = cfg.instructions != "" || skillNames != [ ];
        message = ''
          tackroom is enabled but declares neither instructions nor skills, so every harness
          would be configured with nothing to say. Set tackroom.instructions to your shared
          rules, or point tackroom.skillsDirectory at a skills directory.
        '';
      }
      {
        assertion = enabledHarnessNames != [ ];
        message = ''
          tackroom is enabled but no harness is. Enable at least one of
          tackroom.harnesses.claude.enable, tackroom.harnesses.codex.enable or
          tackroom.harnesses.opencode.enable.
        '';
      }
    ];

    home.packages = builtins.filter (package: package != null) (
      map (harness: cfg.harnesses.${harness}.package) enabledHarnessNames
    );
  };
}
