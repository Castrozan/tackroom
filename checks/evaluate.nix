{
  pkgs,
  lib,
  module,
}:
let
  homeManagerSurfaceStub = {
    options.home = {
      username = lib.mkOption {
        type = lib.types.str;
        default = "fixture-user";
      };
      homeDirectory = lib.mkOption {
        type = lib.types.str;
        default = "/home/fixture-user";
      };
      file = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      packages = lib.mkOption {
        type = lib.types.listOf lib.types.package;
        default = [ ];
      };
      activation = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      sessionVariables = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
    };
    options.assertions = lib.mkOption {
      type = lib.types.listOf (
        lib.types.submodule {
          options = {
            assertion = lib.mkOption { type = lib.types.bool; };
            message = lib.mkOption { type = lib.types.str; };
          };
        }
      );
      default = [ ];
    };
  };
in
{
  evaluateTackroom =
    tackroomSettings:
    (lib.evalModules {
      modules = [
        homeManagerSurfaceStub
        module
        { _module.args.pkgs = pkgs; }
        tackroomSettings
      ];
    }).config;

  projectionOf = evaluated: evaluated.tackroom.internal.projection;

  unmetAssertions = evaluated: builtins.filter (entry: !entry.assertion) evaluated.assertions;
}
