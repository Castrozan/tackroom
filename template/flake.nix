{
  description = "My agent harness configuration, managed by tackroom";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
    home-manager = {
      url = "github:nix-community/home-manager/release-25.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    tackroom = {
      url = "github:castrozan/tackroom";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      home-manager,
      tackroom,
      ...
    }:
    let
      declaredIdentity =
        if builtins.pathExists ./identity.nix then
          import ./identity.nix
        else
          throw "identity.nix is missing. Create it with your username, homeDirectory and system, and make sure git is tracking it, because a flake only reads tracked files.";

      identity =
        if nixpkgs.lib.hasPrefix "REPLACE-WITH" declaredIdentity.username then
          throw "Fill in identity.nix with the username, home directory and system of this machine. `npx tackroom init` writes it for you."
        else
          declaredIdentity;

      unfreeHarnessBinaries = [ "claude-code" ];

      pkgs = import nixpkgs {
        inherit (identity) system;
        config.allowUnfreePredicate =
          package: builtins.elem (nixpkgs.lib.getName package) unfreeHarnessBinaries;
      };

      homeConfiguration = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          tackroom.homeManagerModules.default
          ./tackroom.nix
          {
            home = {
              inherit (identity) username homeDirectory;
              stateVersion = "25.11";
            };
          }
        ];
      };
    in
    {
      homeConfigurations.${identity.username} = homeConfiguration;

      packages.${identity.system}.default = homeConfiguration.activationPackage;

      apps.${identity.system}.apply = {
        type = "app";
        program = "${homeConfiguration.activationPackage}/activate";
      };
    };
}
