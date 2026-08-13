{
  description = "tackroom - one declarative source for Claude Code, Codex and OpenCode configuration";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = lib.genAttrs supportedSystems;
    in
    {
      homeManagerModules.tackroom = import ./module;
      homeManagerModules.default = self.homeManagerModules.tackroom;

      templates.default = {
        path = ./template;
        description = "A tackroom configuration repository";
      };
      templates.tackroom = self.templates.default;

      checks = import ./checks {
        inherit
          self
          nixpkgs
          lib
          forAllSystems
          ;
      };

      formatter = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        pkgs.writeShellApplication {
          name = "tackroom-fmt";
          runtimeInputs = [
            pkgs.nixfmt-rfc-style
            pkgs.ruff
            pkgs.shfmt
            pkgs.nodePackages.prettier
            pkgs.findutils
          ];
          text = ''
            find . -name '*.nix' -not -path './.git/*' -print0 |
              xargs -0 --no-run-if-empty nixfmt
            ruff format .
            find . -name '*.sh' -not -path './.git/*' -print0 |
              xargs -0 --no-run-if-empty shfmt -w
            prettier --write '**/*.{js,mjs,json,md}' --log-level warn
          '';
        }
      );

      apps = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          lint = pkgs.writeShellApplication {
            name = "tackroom-lint";
            runtimeInputs = [
              pkgs.statix
              pkgs.deadnix
              pkgs.ruff
              pkgs.shellcheck
              pkgs.findutils
            ];
            text = ''
              status=0
              statix check . -i template || status=1
              deadnix --fail . || status=1
              ruff check . || status=1
              ruff format --check . || status=1
              find . -name '*.sh' -not -path './.git/*' -print0 |
                xargs -0 --no-run-if-empty shellcheck || status=1
              exit "$status"
            '';
          };
        in
        {
          lint = {
            type = "app";
            program = "${lint}/bin/tackroom-lint";
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              (pkgs.python312.withPackages (pythonPackages: [ pythonPackages.pytest ]))
              pkgs.nodejs_22
              pkgs.nixfmt-rfc-style
              pkgs.statix
              pkgs.deadnix
              pkgs.ruff
              pkgs.shfmt
              pkgs.shellcheck
            ];
          };
        }
      );
    };
}
