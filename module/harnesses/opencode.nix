{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  harness = cfg.harnesses.opencode;
  inherit (cfg) internal;

  subagentTranslation = import ../lib/subagents.nix {
    inherit lib;
    inherit (internal) tackroomLib;
  };

  translatedSubagents = builtins.listToAttrs (
    map (fileName: {
      name = ".config/opencode/agent/${fileName}";
      value = {
        text = subagentTranslation.translateToOpenCode (
          builtins.readFile (cfg.subagentsDirectory + "/${fileName}")
        );
      };
    }) internal.subagentFileNames
  );

  mcpServerRegistration = lib.mapAttrs (
    _name: server:
    {
      type = "local";
      command = [ server.command ] ++ server.args;
      enabled = true;
    }
    // lib.optionalAttrs (server.env != { }) { environment = server.env; }
  ) cfg.mcpServers;

  declaredSettings = {
    "$schema" = "https://opencode.ai/config.json";
    instructions = [ "~/.config/opencode/AGENTS.md" ];
  }
  // lib.optionalAttrs (harness.model != null) { inherit (harness) model; }
  // lib.optionalAttrs (cfg.mcpServers != { }) { mcp = mcpServerRegistration; }
  // harness.settings;

  settingsSource = pkgs.writeText "tackroom-opencode-config.json" (builtins.toJSON declaredSettings);
in
{
  config = lib.mkIf (cfg.enable && harness.enable) {
    tackroom.declared.opencodeSettings = declaredSettings;

    home = {
      file = {
        ".config/opencode/AGENTS.md".text = internal.instructionsFor "opencode";
      }
      // lib.optionalAttrs internal.hooks.guardrailsAreDeclared {
        ".config/opencode/plugin/tackroom-guards.js".source = internal.hooks.opencodePluginFile;
      }
      // internal.skillFilesUnder ".config/opencode/skills"
      // translatedSubagents;

      sessionVariables.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = "true";

      activation.tackroomOpencodeConfig = internal.mergeManagedConfig {
        managedSource = settingsSource;
        liveTarget = "${config.home.homeDirectory}/.config/opencode/opencode.json";
        documentFormat = "json";
      };
    };
  };
}
