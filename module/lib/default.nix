{ lib }:
rec {
  readInstructions =
    instructions: if builtins.isPath instructions then builtins.readFile instructions else instructions;

  frontmatterDelimiter = "---";

  splitFrontmatter =
    markdown:
    let
      lines = lib.splitString "\n" markdown;
      opensWithFrontmatter = (builtins.head (lines ++ [ "" ])) == frontmatterDelimiter;
      afterOpening = builtins.tail lines;
      closingIndexes = lib.imap0 (
        index: line: if line == frontmatterDelimiter then index else null
      ) afterOpening;
      firstClosingIndex = builtins.head (
        builtins.filter (index: index != null) closingIndexes ++ [ null ]
      );
    in
    if !opensWithFrontmatter || firstClosingIndex == null then
      {
        frontmatter = [ ];
        body = markdown;
      }
    else
      {
        frontmatter = lib.take firstClosingIndex afterOpening;
        body = lib.concatStringsSep "\n" (lib.drop (firstClosingIndex + 1) afterOpening);
      };

  frontmatterField =
    frontmatterLines: field:
    let
      prefix = "${field}:";
      matching = builtins.filter (line: lib.hasPrefix prefix line) frontmatterLines;
    in
    if matching == [ ] then
      null
    else
      lib.removePrefix " " (lib.removePrefix prefix (builtins.head matching));

  directoryEntryNames =
    directory:
    if directory == null || !(builtins.pathExists directory) then
      [ ]
    else
      builtins.attrNames (builtins.readDir directory);

  skillNamesIn =
    directory:
    builtins.filter (name: builtins.pathExists (directory + "/${name}/SKILL.md")) (
      directoryEntryNames directory
    );

  markdownFileNamesIn =
    directory: builtins.filter (name: lib.hasSuffix ".md" name) (directoryEntryNames directory);

  expandHome =
    homeDirectory: path:
    if lib.hasPrefix "~/" path then homeDirectory + (lib.removePrefix "~" path) else path;
}
