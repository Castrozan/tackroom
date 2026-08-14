# Architecture

## The shape of the problem

Three agent CLIs, one operator, one set of intentions. Claude Code, Codex and OpenCode each
read instructions, skills, subagents and MCP servers, and each stores them differently
enough that no file can be shared. There is no common format to standardise on and no prospect
of one, because the differences are real capability differences rather than arbitrary choices.

So the work is translation, not standardisation. You author in one neutral vocabulary and each
harness receives its own native dialect. Everything here follows from that.

## Who this is for

Someone who drives at least one of these CLIs daily, wants their agent setup in git, wants it
identical on a laptop and a server, and has no interest in learning Nix. Nix is the engine
because nothing else gives reproducible projection plus rollback on macOS and Linux without a
full system takeover. It is deliberately kept out of sight.

## Three layers

**Bootstrap.** An npm package with no dependencies. `npx tackroom init` installs Nix if it is
missing, scaffolds a repository from the flake template, records the machine's identity, puts
the files under git, and applies. Node is chosen because it is already present on the machine
of anyone running these CLIs, and `npx` needs no install step of its own. The CLI never becomes
load-bearing: everything it does is a documented command a user can run by hand.

**Declaration.** A home-manager module whose option surface is written in the user's vocabulary
rather than the harnesses'. `instructions`, `skillsDirectory`, `subagentsDirectory`.
No option requires knowing which file a harness reads or what format it wants.

**Escape.** `harnesses.<name>.settings` passes native configuration straight through, merged
over everything generated. Any gap in the modelled surface stays reachable without a fork, which
is what keeps the modelled surface free to stay small.

## Why the live config files are merged rather than symlinked

Home-manager's normal move is a read-only symlink into the store. That is wrong for these three
files specifically: all of them are written by the harness itself at runtime, so a symlink turns
ordinary operation into a crash or a silent write failure.

Instead each apply merges the declared document over the live one, key by key, and writes it
back in place. Declared keys win, harness-written keys survive, and a corrupt live file is
replaced rather than inherited. Instructions, skills and subagents are not written back to by
anyone, so those stay ordinary symlinks and keep the rollback story intact.

## Why the translation is borrowed

Writing the per-harness translation ourselves was the original design and it was wrong. Three
harnesses is the number today; each one moves independently, and the translation table is pure
maintenance with no insight in it. rulesync already tracks 30+ agents, and during this rewrite it
knew something our own code did not: Codex grew a subagent format, so the check asserting Codex
gets no agent files was asserting a fact that had expired.

So tackroom renders its declaration into rulesync's source format and runs it. The option surface
stays ours, because that is the part a user reads and the part that should not track anyone
else's vocabulary.

The engine runs inside a derivation with `HOME` set to the output, from a dependency tree pinned
by a fixed output hash. Generation is offline, reproducible, and part of the generation you can
roll back. That is what Nix contributes here, and it is the only thing running the same tool by
hand cannot give you.

## What the checks are for

The product promise is that a rule you write once applies everywhere. That promise is only
worth something if it is enforced, so the checks assert it directly rather than testing
implementation details:

- the instruction body arrives byte-identical on every enabled harness
- a per-harness suffix reaches its own harness and no other
- every declared skill lands in every harness's skill directory
- subagents arrive on every harness, in OpenCode's own schema
- enabling tackroom with nothing declared fails the build instead of deploying three empty
  harnesses

Most of these now run against the built projection rather than against evaluated Nix, which is
the point: they check what the engine actually produced, so an engine upgrade that changes a
layout fails here rather than on someone's machine.

A drift that these do not catch is a bug in the check set, not an acceptable outcome.

## Decisions worth arguing with

**Nix, for a non-Nix audience.** It buys reproducibility, atomic apply and rollback, and it is
the only option that works the same on macOS and Linux without owning the machine. The cost is a
large install for a small config, paid once, and a body of concepts the CLI exists to hide.

**npm as the front door.** Node is already installed for everyone in this audience, and `npx`
means the first command needs no install. The alternative, a shell script behind `curl | sh`, is
lighter but harder to version and audit.

**A flake template rather than files embedded in the npm package.** The scaffold and the module
version together, so `init` can never produce a configuration the module cannot read.

**Merging over symlinking.** Explained above. The cost is that the live file is not a pure
function of the declaration, so a key you delete from your config stays in the live file until
you delete it there. The alternative breaks all three harnesses, which is worse.

**Enforcement lives elsewhere.** A guard that refuses a dangerous command is an ordinary
executable reading JSON on stdin. Nothing about it wants a build system, and cc-safety-net already
ships one across twelve agents, so this module would only be a second, worse copy.

## Deliberately out of scope

Supervising long-running agents, terminal multiplexing, telemetry, prompt or model routing, and
per-project configuration. The first two have their own tools. The rest would each pull a whole
product's worth of surface behind them.

## Where it goes next

Per-project overlays, so a repository can add rules on top of the machine set. More harnesses,
each one a target in the engine. A `tackroom diff` that shows what an apply would change before it changes it.
Sharing a skills directory between machines through a second flake input.
