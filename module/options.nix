{ lib, pkgs, ... }:
let
  inherit (lib) mkOption mkEnableOption types;

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
        Deployed to Claude Code as authored, translated into OpenCode's own frontmatter
        schema, and into Codex's TOML agent format.
      '';
      example = lib.literalExpression "./subagents";
    };

    mcpServers = mkOption {
      type = types.attrsOf mcpServerType;
      default = { };
      description = "MCP servers declared once and registered with every enabled harness.";
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

    engine = {
      version = mkOption {
        type = types.str;
        default = "16.12.0";
        description = ''
          Version of rulesync, the tool that translates the declaration above into each
          harness's native files. Bumping this needs a matching registryHash.
        '';
      };

      registryHash = mkOption {
        type = types.str;
        default = "sha256-jqrcv8Yp9E8Pt5zPKwOnusDwFzXzqmhWgwHYUrLQ6sE=";
        description = ''
          Hash of the engine's installed dependency tree. It pins what a build may fetch, so
          the projection is reproducible rather than whatever the registry serves today. A
          mismatch fails the build loudly and prints the hash to paste back here.
        '';
      };
    };

    internal = mkOption {
      type = types.attrsOf types.anything;
      default = { };
      internal = true;
      description = "Computed artifacts the placement module reads.";
    };
  };
}
