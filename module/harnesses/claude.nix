{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  harness = cfg.harnesses.claude;
  inherit (cfg) internal;

  subagentFiles = builtins.listToAttrs (
    map (fileName: {
      name = ".claude/agents/${fileName}";
      value = {
        source = cfg.subagentsDirectory + "/${fileName}";
      };
    }) internal.subagentFileNames
  );

  hookRegistration = {
    PreToolUse = [
      {
        matcher = "*";
        hooks = [
          {
            type = "command";
            command = internal.hooks.claudePreToolUseCommand;
            timeout = 10;
          }
        ];
      }
    ];
  };

  declaredSettings =
    lib.optionalAttrs (harness.model != null) { inherit (harness) model; }
    // lib.optionalAttrs internal.hooks.guardrailsAreDeclared { hooks = hookRegistration; }
    // harness.settings;

  settingsSource = pkgs.writeText "tackroom-claude-settings.json" (builtins.toJSON declaredSettings);

  mcpServerRegistration = {
    mcpServers = lib.mapAttrs (_name: server: {
      inherit (server) command args;
      inherit (server) env;
    }) cfg.mcpServers;
  };

  mcpSource = pkgs.writeText "tackroom-claude-mcp.json" (builtins.toJSON mcpServerRegistration);
in
{
  config = lib.mkIf (cfg.enable && harness.enable) {
    tackroom.declared.claudeSettings = declaredSettings;

    home = {
      file = {
        ".claude/CLAUDE.md".text = internal.instructionsFor "claude";
      }
      // internal.skillFilesUnder ".claude/skills"
      // subagentFiles;

      activation = {
        tackroomClaudeSettings = internal.mergeManagedConfig {
          managedSource = settingsSource;
          liveTarget = "${config.home.homeDirectory}/.claude/settings.json";
          documentFormat = "json";
        };
      }
      // lib.optionalAttrs (cfg.mcpServers != { }) {
        tackroomClaudeMcpServers = internal.mergeManagedConfig {
          managedSource = mcpSource;
          liveTarget = "${config.home.homeDirectory}/.claude.json";
          documentFormat = "json";
        };
      };
    };
  };
}
