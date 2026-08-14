# Architecture

## The shape of the problem

Three agent CLIs, one operator, one set of intentions. Claude Code, Codex and OpenCode each
read instructions, skills, subagents, hooks and MCP servers, and each stores them differently
enough that no file can be shared. There is no common format to standardise on and no prospect
of one, because the differences are real capability differences rather than arbitrary choices.

So the work is translation, not standardisation. You author in one neutral vocabulary and each
harness receives its own native dialect. Everything here follows from that.

## Who this is for

Someone who drives at least one of these CLIs daily, wants their agent setup in git, and wants
it to be the same setup wherever they run it. The whole thing should be readable by someone who
opens the directory for the first time, which rules out anything that needs its own toolchain
before the first file makes sense.

## Three layers

**Declaration.** A `tackroom.jsonc` written in the user's vocabulary rather than the
harnesses': `instructions`, `skills`, `subagents`, `hooks`, `mcpServers`. No key requires
knowing which file a harness reads or what format it wants. Validation reports every problem in
the file at once rather than dying on the first.

**Translation.** The declaration is rendered into rulesync's source format in a temporary
directory and the engine is run against it. Nothing is written to your home directory by
tackroom itself.

**The scripts.** Hooks are executables that live in the configuration directory and are
referenced by absolute path, so editing one takes effect without an apply and moving the
directory does not silently break them.

## Why the translation is borrowed

Writing the per-harness translation ourselves was the original design and it was wrong. Three
harnesses is the number today; each one moves independently, and the translation table is pure
maintenance with no insight in it. rulesync already tracks 30+ agents, and during the rewrite it
knew something our own code did not: Codex grew a subagent format, so the check asserting Codex
gets no agent files was asserting a fact that had expired.

The option surface stays ours, because that is the part a user reads and the part that should
not track anyone else's vocabulary.

## What the tests are for

The product promise is that a rule you write once applies everywhere. That promise is only
worth something if it is enforced, so the tests run the real engine into a sandboxed home and
assert on what it produced:

- the instruction body arrives byte-identical on every enabled harness
- a per-harness suffix reaches its own harness and no other
- every declared skill lands in every harness's skill directory
- subagents arrive on every harness, in each one's own schema
- a hook reaches all three, with its command as an absolute path
- a harness left out of the declaration receives nothing

They check what the engine actually wrote, so an engine upgrade that changes a layout fails here
rather than on someone's machine. A drift these do not catch is a bug in the test set, not an
acceptable outcome.

## Decisions worth arguing with

**No Nix.** An earlier version was a home-manager module with the engine pinned by a
fixed-output derivation and the results symlinked out of the store. It bought engine pinning,
which `package-lock.json` also buys; rollback, which git also buys for a directory of markdown;
and atomic apply, which was already only partial because the config documents had to be merged
in place rather than symlinked. Against that it cost a multi-gigabyte install, a daemon, a
tracked file recording which machine you were on, and a language the audience does not know. It
also forced three layers, a projection derivation, a placement module and a merge script, that
existed only because a build sandbox cannot write to your home directory. Dropping it deleted
all of them.

**A committed lockfile rather than a version range.** An apply should produce the same files
today and next month. Updating the engine is a deliberate act with a diff to read.

**Hooks by absolute path rather than copied into place.** A copied script is a second source of
truth that goes stale between applies. Referencing the file where you edit it means what you run
is what you wrote.

**Honest hook fidelity rather than a lowest common denominator.** OpenCode's generated plugin
cannot pass a payload to the command. tackroom could have hidden that by refusing to model hooks
at all, or papered over it by writing its own OpenCode plugin and taking on the maintenance we
just shed. Instead the limitation is documented, `doctor` warns about it, and the scaffolded
sample degrades to a no-op where it cannot see what it would be refusing.

**Enforcement patterns live elsewhere.** tackroom ships the wiring and one sample. A maintained
library of dangerous-command patterns is a different product, and cc-safety-net already is it.

## Deliberately out of scope

Supervising long-running agents, terminal multiplexing, telemetry, prompt or model routing, and
per-project configuration. The first two have their own tools. The rest would each pull a whole
product's worth of surface behind them.

## Where it goes next

Per-project overlays, so a repository can add rules on top of the machine set. More harnesses,
each one a target in the engine. A `tackroom diff` that shows what an apply would change in
full, rather than only which files it would touch.
