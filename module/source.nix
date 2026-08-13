{
  pkgs,
  lib,
  cfg,
  tackroomLib,
}:
let
  engineTargetByHarness = {
    claude = "claudecode";
    codex = "codexcli";
    opencode = "opencode";
  };

  enabledHarnessNames = builtins.filter (name: cfg.harnesses.${name}.enable) (
    builtins.attrNames engineTargetByHarness
  );

  enabledTargets = map (name: engineTargetByHarness.${name}) enabledHarnessNames;

  instructionsBody = lib.trim (tackroomLib.readInstructions cfg.instructions);

  bodyFor =
    harnessName:
    let
      suffix = lib.trim cfg.harnesses.${harnessName}.instructionsSuffix;
    in
    if suffix == "" then instructionsBody else "${instructionsBody}\n\n${suffix}";

  ruleFiles = builtins.listToAttrs (
    map (harnessName: {
      name = ".rulesync/rules/${harnessName}.md";
      value = pkgs.writeText "tackroom-rules-${harnessName}.md" ''
        ---
        root: true
        targets: ["${engineTargetByHarness.${harnessName}}"]
        description: "Instructions tackroom declares for every agent on this machine"
        ---

        ${bodyFor harnessName}
      '';
    }) enabledHarnessNames
  );

  mcpDocument = {
    mcpServers = lib.mapAttrs (_name: server: {
      type = "stdio";
      inherit (server) command args env;
    }) cfg.mcpServers;
  };

  mcpFile = lib.optionalAttrs (cfg.mcpServers != { }) {
    ".rulesync/mcp.jsonc" = pkgs.writeText "tackroom-mcp.jsonc" (builtins.toJSON mcpDocument);
  };

  declaredFeatures = [
    "rules"
  ]
  ++ lib.optional (cfg.skillsDirectory != null) "skills"
  ++ lib.optional (cfg.subagentsDirectory != null) "subagents"
  ++ lib.optional (cfg.mcpServers != { }) "mcp";

  configurationFile = pkgs.writeText "rulesync.jsonc" (
    builtins.toJSON {
      targets = enabledTargets;
      features = declaredFeatures;
      global = true;
      delete = true;
      silent = false;
    }
  );

  sourceFiles = ruleFiles // mcpFile // { "rulesync.jsonc" = configurationFile; };

  copyDeclaredDirectory =
    declared: destination:
    lib.optionalString (declared != null) ''
      mkdir -p "$out/${destination}"
      cp -R ${declared}/. "$out/${destination}/"
    '';
in
pkgs.runCommandLocal "tackroom-engine-source" { } ''
  ${lib.concatStringsSep "\n" (
    lib.mapAttrsToList (destination: file: ''
      mkdir -p "$(dirname "$out/${destination}")"
      cp ${file} "$out/${destination}"
    '') sourceFiles
  )}
  ${copyDeclaredDirectory cfg.skillsDirectory ".rulesync/skills"}
  ${copyDeclaredDirectory cfg.subagentsDirectory ".rulesync/subagents"}
  chmod -R u+w "$out"
''
