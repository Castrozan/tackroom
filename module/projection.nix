{
  pkgs,
  lib,
  engine,
  source,
  guaranteedPaths,
}:
let
  directoriesToGuarantee = lib.unique (
    map (
      entry: if entry.kind == "directory" then entry.path else builtins.dirOf entry.path
    ) guaranteedPaths
  );
in
pkgs.runCommand "tackroom-projection" { nativeBuildInputs = [ engine ]; } ''
  cp -RL ${source}/. source
  chmod -R u+w source
  cd source

  export HOME="$out"
  mkdir -p "$HOME"
  rulesync generate --global

  ${lib.concatMapStringsSep "\n" (directory: ''mkdir -p "$out/${directory}"'') directoriesToGuarantee}
''
