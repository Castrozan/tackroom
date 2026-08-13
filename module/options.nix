{ lib, pkgs, ... }:
let
  inherit (lib) mkOption mkEnableOption types;

  blockedCommandType = types.submodule {
    options = {
      pattern = mkOption {
        type = types.str;
        description = "Python regular expression searched against the command line an agent is about to run.";
        example = "\\bgit\\s+add\\s+(-A|--all|\\.)(\\s|$)";
      };
      reason = mkOption {
        type = types.str;
        description = "Sentence shown to the agent instead of the command output. Say what to do instead, not only what is forbidden.";
        example = "Stage specific files; git add -A sweeps in unrelated parallel work.";
      };
    };
  };

  mcpServerType = types.submodule {
    options = {
      command = mkOption {
        type = types.str;
        description = "Executable that speaks MCP over stdio.";
      };
      args = mkOption {
        type = types.listOf types.str;
        default = [ ];
        description = "Arguments passed to the MCP server command.";
      };
      env = mkOption {
        type = types.attrsOf types.str;
        default = { };
        description = "Extra environment for the MCP server process.";
      };
    };
  };

  harnessOptions =
    { displayName, packageAttribute }:
    {
      enable = mkEnableOption "${displayName} configuration management";

      package = mkOption {
        type = types.nullOr types.package;
        default = pkgs.${packageAttribute} or null;
        defaultText = lib.literalExpression "pkgs.${packageAttribute}";
        description = ''
          The ${displayName} binary to install. Set to null when you install ${displayName}
          yourself (npm, curl, a system package manager) and want tackroom to manage only its
          configuration. Config management works either way.
        '';
      };

      model = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Default model for ${displayName}. Null leaves the harness default in place.";
      };

      settings = mkOption {
        type = types.attrsOf types.anything;
        default = { };
        description = ''
          Escape hatch. Native ${displayName} configuration merged over everything tackroom
          generates, so any key tackroom does not model yet is still reachable without
          forking this module.
        '';
      };

      instructionsSuffix = mkOption {
        type = types.lines;
        default = "";
        description = ''
          Extra instructions appended to the shared set for ${displayName} only. Use it for
          genuine capability differences between harnesses, not for rules that should apply
          everywhere.
        '';
      };
    };
in
{
  options.tackroom = {
    enable = mkEnableOption "tackroom, one declarative source for every agent harness on this machine";

    instructions = mkOption {
      type = types.either types.lines types.path;
      default = "";
      description = ''
        The always-on instruction set every enabled harness loads. Written once here and
        projected byte-identical to Claude Code's CLAUDE.md, Codex's AGENTS.md and OpenCode's
        AGENTS.md, so the three cannot drift apart. A path is read as a file.
      '';
      example = lib.literalExpression "./instructions/AGENTS.md";
    };

    skillsDirectory = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Directory of skills, each a subdirectory holding a SKILL.md. Every skill is deployed
        into every enabled harness's own skill location.
      '';
      example = lib.literalExpression "./skills";
    };

    subagentsDirectory = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Directory of subagent definitions as Claude-flavoured markdown with frontmatter.
        Deployed to Claude Code as authored and translated into OpenCode's own frontmatter
        schema. Codex has no user-defined subagent file format, so it is skipped there.
      '';
      example = lib.literalExpression "./subagents";
    };

    mcpServers = mkOption {
      type = types.attrsOf mcpServerType;
      default = { };
      description = "MCP servers declared once and registered with every enabled harness.";
    };

    guardrails = {
      blockedCommands = mkOption {
        type = types.listOf blockedCommandType;
        default = [ ];
        description = ''
          Commands no agent may run on this machine, enforced by a pre-tool-use hook on every
          enabled harness. The agent receives the reason and can adjust, so this shapes
          behaviour rather than just failing.
        '';
      };

      protectedPaths = mkOption {
        type = types.listOf types.str;
        default = [ ];
        description = ''
          Paths no agent may write to, matched as prefixes against the resolved target of a
          write or edit. Enforced on every enabled harness.
        '';
        example = [
          "~/.ssh"
          "~/.gnupg"
        ];
      };
    };

    harnesses = {
      claude = harnessOptions {
        displayName = "Claude Code";
        packageAttribute = "claude-code";
      };
      codex = harnessOptions {
        displayName = "Codex";
        packageAttribute = "codex";
      };
      opencode = harnessOptions {
        displayName = "OpenCode";
        packageAttribute = "opencode";
      };
    };

    internal = mkOption {
      type = types.attrsOf types.anything;
      default = { };
      internal = true;
      description = "Computed artifacts every harness projection reads.";
    };

    declared = mkOption {
      type = types.attrsOf types.anything;
      default = { };
      internal = true;
      description = ''
        What each harness projection ended up declaring, exposed for the flake checks. Kept
        separate from internal so a projection can publish here while reading there without
        making the option set self-referential.
      '';
    };
  };
}
