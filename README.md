# tackroom

Declare your Claude Code, Codex and OpenCode setup once. Apply it on any machine.

A tackroom is the room in a stable where the harnesses are kept, repaired and fitted before
use. This is that room for the agent CLIs you drive: one repository holding the rules, skills,
subagents, MCP servers and guardrails, projected onto whichever of them you run.

```bash
npx tackroom init ~/agents
```

Or straight from this repository, which is also how you run an unreleased change:

```bash
npx github:castrozan/tackroom init ~/agents
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

| You declare          | Claude Code           | Codex                  | OpenCode                           |
| -------------------- | --------------------- | ---------------------- | ---------------------------------- |
| `instructions`       | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md`   | `~/.config/opencode/AGENTS.md`     |
| `skillsDirectory`    | `~/.claude/skills/`   | `~/.agents/skills/`    | `~/.config/opencode/skills/`       |
| `subagentsDirectory` | `~/.claude/agents/`   | `~/.codex/agents/`     | `~/.config/opencode/agents/`       |
| `mcpServers`         | `~/.claude.json`      | `~/.codex/config.toml` | `~/.config/opencode/opencode.json` |
| `guardrails`         | `settings.json` hooks | `config.toml` hooks    | `plugin/tackroom-guards.js`        |

The instruction body arrives byte-identical on all three, and a flake check fails the build if
it ever does not. Subagent frontmatter is rewritten per harness on the way, because OpenCode
treats an agent file it cannot parse as a fatal config error rather than skipping it, and Codex
wants TOML rather than markdown.

## What does the translating

tackroom does not write those files itself. It renders your declaration into the source format
of [rulesync](https://github.com/dyoshikawa/rulesync) and runs it, so the per-harness knowledge
lives in a project that tracks 30+ agents rather than in a module that would fall behind them.

The engine runs inside the build, not on your machine, from a dependency tree pinned by hash.
Generation is therefore offline, reproducible and rolled back with the rest of a home-manager
generation, which is the part a `generate` command run by hand cannot give you.

Guardrails are the exception and stay tackroom's own, because the engine's OpenCode hook output
invokes the command without the tool input and ignores its answer, which is a notifier rather
than a guard.

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

`doctor` compares what is deployed in your home against what this repository declares, so it
tells you a harness is stale rather than that a file exists. It also checks the trap that costs
everyone an afternoon: a Nix flake only reads files git is tracking, so a new skill you have not
staged is invisible to the build. `apply` stages them for you and says so.

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
