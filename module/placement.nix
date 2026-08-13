{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.tackroom;
  tackroomLib = import ./lib { inherit lib; };

  engine = import ./engine.nix {
    inherit pkgs;
    inherit (cfg.engine) version registryHash;
  };

  source = import ./source.nix {
    inherit
      pkgs
      lib
      cfg
      tackroomLib
      ;
  };

  declaresSkills = cfg.skillsDirectory != null;
  declaresSubagents = cfg.subagentsDirectory != null;
  declaresMcpServers = cfg.mcpServers != { };

  harnessPlacements = {
    claude = {
      instructions = ".claude/CLAUDE.md";
      skills = ".claude/skills";
      subagents = ".claude/agents";
      mcpDocument = {
        path = ".claude.json";
        format = "json";
      };
    };
    codex = {
      instructions = ".codex/AGENTS.md";
      skills = ".agents/skills";
      subagents = ".codex/agents";
      mcpDocument = {
        path = ".codex/config.toml";
        format = "toml";
      };
    };
    opencode = {
      instructions = ".config/opencode/AGENTS.md";
      skills = ".config/opencode/skills";
      subagents = ".config/opencode/agents";
      mcpDocument = {
        path = ".config/opencode/opencode.jsonc";
        format = "json";
      };
    };
  };

  enabledHarnessNames = builtins.filter (name: cfg.harnesses.${name}.enable) (
    builtins.attrNames harnessPlacements
  );

  linkedPathsFor =
    harnessName:
    let
      placement = harnessPlacements.${harnessName};
    in
    [
      {
        path = placement.instructions;
        kind = "file";
      }
    ]
    ++ lib.optional declaresSkills {
      path = placement.skills;
      kind = "directory";
    }
    ++ lib.optional declaresSubagents {
      path = placement.subagents;
      kind = "directory";
    };

  linkedPaths = lib.concatMap linkedPathsFor enabledHarnessNames;

  mergedDocuments = lib.optionals declaresMcpServers (
    map (
      harnessName: harnessPlacements.${harnessName}.mcpDocument // { inherit harnessName; }
    ) enabledHarnessNames
  );

  projection = import ./projection.nix {
    inherit
      pkgs
      lib
      engine
      source
      ;
    guaranteedPaths =
      linkedPaths
      ++ map (document: {
        inherit (document) path;
        kind = "file";
      }) mergedDocuments;
  };

  linkEntry = entry: {
    name = entry.path;
    value = {
      source = "${projection}/${entry.path}";
      recursive = entry.kind == "directory";
    };
  };

  mergeEntry = document: {
    name = "tackroomProjected${lib.toSentenceCase document.harnessName}McpServers";
    value = cfg.internal.mergeManagedConfig {
      managedSource = "${projection}/${document.path}";
      liveTarget = "${config.home.homeDirectory}/${document.path}";
      documentFormat = document.format;
    };
  };
in
{
  config = lib.mkIf cfg.enable {
    tackroom.internal = {
      inherit projection engine;
      engineSource = source;
    };

    home.file = builtins.listToAttrs (map linkEntry linkedPaths);
    home.activation = builtins.listToAttrs (map mergeEntry mergedDocuments);
  };
}
