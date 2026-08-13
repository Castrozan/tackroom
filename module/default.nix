{ ... }:
{
  imports = [
    ./options.nix
    ./internal.nix
    ./harnesses/claude.nix
    ./harnesses/codex.nix
    ./harnesses/opencode.nix
  ];
}
