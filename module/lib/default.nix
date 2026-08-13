{ lib }:
{
  readInstructions =
    instructions: if builtins.isPath instructions then builtins.readFile instructions else instructions;

  expandHome =
    homeDirectory: path:
    if lib.hasPrefix "~/" path then homeDirectory + (lib.removePrefix "~" path) else path;
}
