# tackroom

[Português](README.pt-BR.md)

Declare your Claude Code, Codex and OpenCode setup once. Apply it anywhere.

A tackroom is the room in a stable where the harnesses are kept, repaired and fitted before
use. This is that room for the agent CLIs you drive: one directory holding the rules, skills,
subagents, hooks and MCP servers, projected onto whichever of them you run.

```bash
npx tackroom init ~/agents
```

That scaffolds a configuration, applies it, and leaves you with an ordinary directory of
markdown and scripts. After that you edit files and run `npx tackroom apply`. There is nothing
to install beyond Node, which you already have, and you never touch `~/.claude`, `~/.codex` or
`~/.config/opencode` by hand again.

## The problem it solves

The three CLIs want the same things and store them in three different shapes. Your rules live
in `CLAUDE.md` for one and `AGENTS.md` for the others. Skills sit under three separate
directories. Subagent frontmatter that Claude accepts will fail OpenCode's config outright, and
Codex wants TOML for the same thing. Hooks are a settings key on one, their own file on
another, and a JavaScript plugin on the third.

Keeping them in step by hand does not fail loudly. It fails by drifting, so a rule you thought
applied everywhere quietly applies to one CLI, and you only notice when an agent does the thing
you told it not to.

## What you write

```jsonc
{
  "harnesses": ["claude", "codex", "opencode"],

  "instructions": "instructions/AGENTS.md",
  "skills": "skills",
  "subagents": "subagents",

  "hooks": {
    "preToolUse": [{ "matcher": "[Bb]ash", "command": "./hooks/refuse-force-push.mjs" }],
  },

  "mcpServers": {
    "chrome-devtools": { "command": "npx", "args": ["chrome-devtools-mcp@latest"] },
  },
}
```

## Where each thing lands

| You declare    | Claude Code               | Codex                  | OpenCode                           |
| -------------- | ------------------------- | ---------------------- | ---------------------------------- |
| `instructions` | `~/.claude/CLAUDE.md`     | `~/.codex/AGENTS.md`   | `~/.config/opencode/AGENTS.md`     |
| `skills`       | `~/.claude/skills/`       | `~/.agents/skills/`    | `~/.config/opencode/skills/`       |
| `subagents`    | `~/.claude/agents/`       | `~/.codex/agents/`     | `~/.config/opencode/agents/`       |
| `hooks`        | `~/.claude/settings.json` | `~/.codex/hooks.json`  | `~/.config/opencode/plugins/`      |
| `mcpServers`   | `~/.claude.json`          | `~/.codex/config.toml` | `~/.config/opencode/opencode.json` |

The instruction body arrives byte-identical on all three, and a test fails the build if it ever
does not. Subagent frontmatter is rewritten per harness on the way, because OpenCode treats an
agent file it cannot parse as a fatal config error rather than skipping it, and Codex wants TOML
rather than markdown.

## Hooks

A hook is an ordinary executable. It runs on an agent lifecycle event, and refusing is how it
earns its keep: exit non-zero and the action is blocked. A command starting with `./` is
resolved against your configuration directory and marked executable on apply, so the script
stays part of the repository rather than something you install separately.

The three harnesses do not offer the same thing here, and tackroom does not pretend otherwise:

**Claude Code** gets native hooks in `settings.json`. Your script receives the full event
payload as JSON on stdin and can answer on stdout with a `permissionDecision` and a reason the
model reads. This is the complete protocol.

**Codex** gets native hooks in `.codex/hooks.json`, command type only.

**OpenCode** gets a generated plugin. The plugin calls your command but passes no payload on
stdin and discards its stdout, so the script can refuse by exiting non-zero but cannot see what
it is refusing. Write hooks that degrade to a no-op when they get no payload, the way the
scaffolded sample does, rather than ones that block blindly.

A `matcher` is a regex tested against each harness's own tool name, and those names differ in
case between harnesses, so `[Bb]ash` rather than `Bash`. This is one of the few things in a
tackroom configuration that is not fully portable.

If what you want is a maintained pattern set rather than your own scripts,
[cc-safety-net](https://github.com/kenryu42/cc-safety-net) does that across twelve agents.

## Commands

```
npx tackroom init [dir]     Scaffold a configuration and apply it
npx tackroom apply [dir]    Project the configuration onto every declared harness
npx tackroom doctor [dir]   Report what is declared, what is deployed, what is stale
```

`doctor` asks the engine itself whether the deployed files still match your declaration, so it
names the files an apply would rewrite rather than guessing from paths it has memorised.

## Guide

**Start.** `npx tackroom init ~/agents` writes the scaffold and applies it. You now have a
directory with `tackroom.jsonc`, an `instructions/AGENTS.md`, one skill, one subagent and one
hook, and three configured CLIs.

**Change a rule.** Edit `instructions/AGENTS.md` and run `npx tackroom apply ~/agents`. All
three harnesses get the new body, byte for byte. Restart any running agent session so it
reloads.

**Add a skill.** Create `skills/<name>/SKILL.md`. Nothing else. It lands in all three skill
directories on the next apply.

**Add a subagent.** Drop a Claude-flavoured markdown file in `subagents/`. It is rewritten into
OpenCode's frontmatter schema and Codex's TOML on the way out.

**Add a hook.** Write the script under `hooks/`, then name it in `tackroom.jsonc`:

```jsonc
"hooks": {
  "preToolUse": [{ "matcher": "[Bb]ash", "command": "./hooks/my-guard.mjs" }]
}
```

Apply marks it executable and rewrites the command to an absolute path. Test the script by
hand before trusting it, because a hook that always exits non-zero blocks every matching call:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | ./hooks/my-guard.mjs; echo $?
```

**Run one harness only.** Drop names from `harnesses`. A harness you remove stops receiving
files, and `doctor` says so rather than leaving you guessing.

**Check the state.** `npx tackroom doctor ~/agents` reports what is declared, what is deployed
and what an apply would rewrite. It exits non-zero when something is stale, so it works in a
shell prompt or a cron line.

**Move it.** `git init`, commit, push, clone elsewhere, `npx tackroom apply`. Roll back with
`git checkout <sha>` and another apply.

## Why not just run rulesync?

You can, and if you are happy writing `.rulesync/` by hand you should. tackroom is a wrapper
over it, and it is worth naming exactly what the wrapper buys.

The substantive one is hook paths. rulesync's hook commands are strings passed through to each
harness, so a repo-local script declared as `./hooks/guard.mjs` in global mode arrives as
`"$CLAUDE_PROJECT_DIR"/hooks/guard.mjs` on Claude Code and as a bare `./hooks/guard.mjs` on
Codex and OpenCode. All three then resolve against whatever project the agent happens to be
sitting in, so the hook points at a file that is not there and silently never fires. tackroom
resolves the command against your configuration directory and marks it executable, so a global
hook actually runs.

The rest is ergonomics. One `instructions/AGENTS.md` and an `instructionsSuffix` map instead of
one rule file per harness with its own frontmatter and `targets` list. A validator that reports
every problem in your config at once, in your vocabulary, and refuses the configurations that
would deploy nothing. One vocabulary to learn rather than the `.rulesync/` layout, its
frontmatter, its features list and its target names.

What tackroom does not add is any translation of its own. Every harness-specific decision is
rulesync's, which is the point.

## What does the translating

tackroom does not write those files itself. It renders your declaration into the source format
of [rulesync](https://github.com/dyoshikawa/rulesync) and runs it, so the per-harness knowledge
lives in a project that tracks 30+ agents rather than in a module that would fall behind them.
The version is pinned in `package-lock.json`, so an apply produces the same output until you
choose to update.

Your live config files are not clobbered. The engine merges what you declared into what is
already there, so keys a harness writes for itself survive an apply.

## Carrying it to another machine

The configuration is an ordinary directory. Put it under git, push it, clone it elsewhere, and
run `npx tackroom apply`. Nothing in it records which machine wrote it, so there is no
per-machine file to reconcile. Rolling back is `git checkout` followed by another apply.

## What this is not

It does not supervise long-running agents; [clawde](https://github.com/castrozan/clawde) does
that. It does not multiplex your terminal; [herdr](https://github.com/castrozan/herdr) does that.
It configures the CLIs and gets out of the way.

## Design

[ARCHITECTURE.md](ARCHITECTURE.md) covers the layering, what is borrowed, and the decisions
worth arguing with.

## Licence

MIT.
