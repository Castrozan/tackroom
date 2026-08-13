{ lib, tackroomLib }:
let
  openCodeToolNameByClaudeToolName = {
    Bash = "bash";
    Edit = "edit";
    Glob = "glob";
    Grep = "grep";
    List = "list";
    Read = "read";
    Task = "task";
    WebFetch = "webfetch";
    WebSearch = "websearch";
    Write = "write";
  };

  everyOpenCodeToolName = builtins.attrValues openCodeToolNameByClaudeToolName;

  requestedToolNames =
    toolsField:
    builtins.filter (name: name != "") (
      map (entry: lib.removeSuffix " " (lib.removePrefix " " entry)) (lib.splitString "," toolsField)
    );

  openCodePermissionMap =
    toolsField:
    let
      allowed = builtins.filter (name: name != null) (
        map (claudeName: openCodeToolNameByClaudeToolName.${claudeName} or null) (
          requestedToolNames toolsField
        )
      );
    in
    builtins.listToAttrs (
      map (toolName: {
        name = toolName;
        value = builtins.elem toolName allowed;
      }) everyOpenCodeToolName
    );

  renderPermissionLines =
    permissionMap:
    map (toolName: "  ${toolName}: ${lib.boolToString permissionMap.${toolName}}") (
      builtins.attrNames permissionMap
    );
in
{
  translateToOpenCode =
    markdown:
    let
      split = tackroomLib.splitFrontmatter markdown;
      description = tackroomLib.frontmatterField split.frontmatter "description";
      toolsField = tackroomLib.frontmatterField split.frontmatter "tools";
      permissionLines =
        if toolsField == null then
          [ ]
        else
          [ "tools:" ] ++ renderPermissionLines (openCodePermissionMap toolsField);
      frontmatterLines = [
        "---"
        "description: ${if description == null then "A tackroom subagent." else description}"
        "mode: subagent"
      ]
      ++ permissionLines
      ++ [ "---" ];
    in
    lib.concatStringsSep "\n" (
      frontmatterLines
      ++ [
        ""
        split.body
      ]
    );
}
