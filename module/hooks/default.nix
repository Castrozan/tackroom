{
  pkgs,
  lib,
  guardrails,
}:
let
  hookPythonInterpreter = "${pkgs.python312}/bin/python3";

  guardrailsFile = pkgs.writeText "tackroom-guardrails.json" (builtins.toJSON guardrails);

  hookScripts = pkgs.runCommandLocal "tackroom-hook-scripts" { } ''
    mkdir -p "$out"
    install -m 0644 ${./runtime}/*.py "$out"/
    install -m 0755 ${./runtime/run-hook.sh} "$out/run-hook.sh"
    substituteInPlace "$out/run-hook.sh" \
      --replace-fail "@hookPythonInterpreter@" "${hookPythonInterpreter}"
  '';

  dispatcherFor =
    surface:
    pkgs.writeShellScript "tackroom-pre-tool-use-${surface}" ''
      export TACKROOM_GUARDRAILS=${lib.escapeShellArg "${guardrailsFile}"}
      exec ${hookScripts}/run-hook.sh ${hookScripts}/pre-tool-use.py --surface=${surface}
    '';

  opencodePlugin = pkgs.replaceVars ../hooks/adapters/opencode-bridge.js {
    preToolUseDispatcher = "${dispatcherFor "opencode"}";
  };
in
{
  inherit hookScripts guardrailsFile;

  claudePreToolUseCommand = "${dispatcherFor "claude"}";
  codexPreToolUseCommand = "${dispatcherFor "codex"}";
  opencodePluginFile = opencodePlugin;

  guardrailsAreDeclared = guardrails.blockedCommands != [ ] || guardrails.protectedPaths != [ ];
}
