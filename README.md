# tackroom

Declare your Claude Code, Codex and OpenCode setup once. Apply it on any machine.

A tackroom is the room in a stable where the harnesses are kept, repaired and fitted before
use. This is that room for the agent CLIs you drive: one repository holding the rules, skills,
subagents, MCP servers and guardrails, projected onto whichever of them you run.

```bash
npx tackroom init ~/agents
```

That scaffolds a configuration repository, installs Nix if you do not have it, and applies the
result. After that, you edit files and run `npx tackroom apply`. You never have to write Nix
beyond filling in the options below, and you never have to touch `~/.claude`, `~/.codex` or
`~/.config/opencode` by hand again.

## The problem it solves

The three CLIs want the same things and store them in three different shapes. Your rules live
in `CLAUDE.md` for one and `AGENTS.md` for the others. Skills sit under three separate
directories. Hooks use three unrelated protocols: a JSON block in `settings.json`, a TOML table
in `config.toml`, and a JavaScript plugin. Subagent frontmatter that Claude accepts will fail
OpenCode's config outright.

Keeping them in step by hand does not fail loudly. It fails by drifting, so a rule you thought
applied everywhere quietly applies to one CLI, and you only notice when an agent does the thing
you told it not to.

tackroom removes the hand-copying. You write each thing once, and the projection onto each
harness is a build step with checks that fail when the three surfaces stop matching.

## What you write

```nix
{
  tackroom = {
    enable = true;

    instructions = ./instructions/AGENTS.md;
    skillsDirectory = ./skills;
    subagentsDirectory = ./subagents;

    harnesses.claude.enable = true;
    harnesses.codex.enable = true;
    harnesses.opencode.enable = true;

    guardrails.blockedCommands = [
      {
        pattern = "\\bgit\\s+add\\s+-A\\b";
        reason = "Stage the files you changed by name.";
      }
    ];

    guardrails.protectedPaths = [ "~/.ssh" "~/.gnupg" ];

    mcpServers.chrome-devtools = {
      command = "npx";
      args = [ "chrome-devtools-mcp@latest" ];
    };
  };
}
```

## Where each thing lands

| You declare          | Claude Code           | Codex                | OpenCode                            |
| -------------------- | --------------------- | -------------------- | ----------------------------------- |
| `instructions`       | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | `~/.config/opencode/AGENTS.md`      |
| `skillsDirectory`    | `~/.claude/skills/`   | `~/.codex/skills/`   | `~/.config/opencode/skills/`        |
| `subagentsDirectory` | `~/.claude/agents/`   | not supported        | `~/.config/opencode/agent/`         |
| `mcpServers`         | `~/.claude.json`      | `~/.codex/config.toml` | `~/.config/opencode/opencode.json` |
| `guardrails`         | `settings.json` hooks | `config.toml` hooks  | `plugin/tackroom-guards.js`         |

The instruction body arrives byte-identical on all three, and a flake check fails the build if
it ever does not. Subagent frontmatter is rewritten into OpenCode's permission-map schema on the
way, because OpenCode treats an agent file it cannot parse as a fatal config error rather than
skipping it. Codex has no user-defined subagent file format, so nothing is written there instead
of writing something that would never be read.

## Guardrails

A guardrail is a rule the agent cannot talk its way past, enforced by a hook on every enabled
harness. `blockedCommands` refuses a shell command and hands the model your reason, so it can
correct course rather than just failing. `protectedPaths` refuses writes anywhere under a path,
whichever field name the harness used to name the file.

The point of putting them here rather than in your prompt is that a prompt is advice and a hook
is not.

## Bring your own binaries

Every harness has a `package` option defaulting to the nixpkgs build. Set it to `null` when you
install the CLI yourself through npm, curl or a system package manager, and tackroom will manage
only its configuration:

```nix
tackroom.harnesses.claude.package = null;
```

## Escape hatch

Anything tackroom does not model yet is still reachable. `harnesses.<name>.settings` is merged
over everything generated, in that harness's own native shape:

```nix
tackroom.harnesses.opencode.settings = {
  small_model = "anthropic/claude-haiku-4-5";
  autoupdate = false;
};
```

Your live config files stay writable. tackroom merges what you declared over what is already
there on every apply, so keys the harness itself writes are preserved rather than clobbered by a
read-only symlink.

## Commands

```
npx tackroom init [dir]     Scaffold a configuration and apply it
npx tackroom apply [dir]    Build and activate
npx tackroom update [dir]   Update pinned inputs, then apply
npx tackroom doctor [dir]   Report what is wired, missing or stale
```

`doctor` checks the trap that costs everyone an afternoon: a Nix flake only reads files git is
tracking, so a new skill you have not staged is invisible to the build. `apply` stages them for
you and says so.

## Using the module directly

The CLI is a convenience, not a dependency. If you already run home-manager, import the module:

```nix
{
  inputs.tackroom.url = "github:castrozan/tackroom";
  inputs.tackroom.inputs.nixpkgs.follows = "nixpkgs";
}
```

```nix
{
  imports = [ inputs.tackroom.homeManagerModules.default ];
  tackroom.enable = true;
}
```

The input set is nixpkgs-only, so following your own nixpkgs keeps your lock free of
tackroom-specific entries.

## What this is not

It does not supervise long-running agents; [clawde](https://github.com/castrozan/clawde) does
that. It does not multiplex your terminal; [herdr](https://github.com/castrozan/herdr) does that.
It configures the CLIs and gets out of the way.

## Design

[ARCHITECTURE.md](ARCHITECTURE.md) covers the layering, the harness translation rules, and the
decisions worth arguing with.

## Licence

MIT.
