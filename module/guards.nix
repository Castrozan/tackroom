{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  inherit (cfg) internal;

  hookRegistration = matcher: command: {
    PreToolUse = [
      {
        inherit matcher;
        hooks = [
          {
            type = "command";
            inherit command;
            timeout = 10;
          }
        ];
      }
    ];
  };

  claudeSettings = {
    hooks = hookRegistration "*" internal.hooks.claudePreToolUseCommand;
  };

  codexConfiguration = {
    features.hooks = true;
    hooks = hookRegistration ".*" internal.hooks.codexPreToolUseCommand;
  };

  claudeSource = pkgs.writeText "tackroom-claude-guards.json" (builtins.toJSON claudeSettings);
  codexSource = (pkgs.formats.toml { }).generate "tackroom-codex-guards.toml" codexConfiguration;

  guardedHarness =
    harnessName: cfg.harnesses.${harnessName}.enable && internal.hooks.guardrailsAreDeclared;
in
{
  config = lib.mkIf cfg.enable {
    home.file = lib.optionalAttrs (guardedHarness "opencode") {
      ".config/opencode/plugin/tackroom-guards.js".source = internal.hooks.opencodePluginFile;
    };

    home.activation =
      lib.optionalAttrs (guardedHarness "claude") {
        tackroomClaudeGuards = internal.mergeManagedConfig {
          managedSource = claudeSource;
          liveTarget = "${config.home.homeDirectory}/.claude/settings.json";
          documentFormat = "json";
        };
      }
      // lib.optionalAttrs (guardedHarness "codex") {
        tackroomCodexGuards = internal.mergeManagedConfig {
          managedSource = codexSource;
          liveTarget = "${config.home.homeDirectory}/.codex/config.toml";
          documentFormat = "toml";
        };
      };
  };
}
