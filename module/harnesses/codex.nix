{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  harness = cfg.harnesses.codex;
  inherit (cfg) internal;

  hookRegistration = {
    PreToolUse = [
      {
        matcher = ".*";
        hooks = [
          {
            type = "command";
            command = internal.hooks.codexPreToolUseCommand;
            timeout = 10;
          }
        ];
      }
    ];
  };

  mcpServerRegistration = lib.mapAttrs (
    _name: server:
    {
      inherit (server) command args;
    }
    // lib.optionalAttrs (server.env != { }) { inherit (server) env; }
  ) cfg.mcpServers;

  declaredConfig =
    lib.optionalAttrs (harness.model != null) { inherit (harness) model; }
    // lib.optionalAttrs internal.hooks.guardrailsAreDeclared {
      features.hooks = true;
      hooks = hookRegistration;
    }
    // lib.optionalAttrs (cfg.mcpServers != { }) { mcp_servers = mcpServerRegistration; }
    // harness.settings;

  configSource = (pkgs.formats.toml { }).generate "tackroom-codex-config.toml" declaredConfig;
in
{
  config = lib.mkIf (cfg.enable && harness.enable) {
    tackroom.declared.codexConfig = declaredConfig;

    home = {
      file = {
        ".codex/AGENTS.md".text = internal.instructionsFor "codex";
      }
      // internal.skillFilesUnder ".codex/skills";

      activation.tackroomCodexConfig = internal.mergeManagedConfig {
        managedSource = configSource;
        liveTarget = "${config.home.homeDirectory}/.codex/config.toml";
        documentFormat = "toml";
      };
    };
  };
}
