{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  tackroomLib = import ./lib { inherit lib; };

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
        mergeManagedConfig
        tackroomLib
        enabledHarnessNames
        ;
    };

    assertions = [
      {
        assertion = cfg.instructions != "" || cfg.skillsDirectory != null;
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
