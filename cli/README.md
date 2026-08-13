# tackroom

Declare your Claude Code, Codex and OpenCode setup once. Apply it on any machine.

```bash
npx tackroom init ~/agents
```

This package is the bootstrap for [tackroom](https://github.com/castrozan/tackroom). It
installs Nix if you do not have it, scaffolds a configuration repository, and applies it. The
configuration itself lives in that repository as plain files you edit and commit.

```
npx tackroom init [dir]     Scaffold a configuration and apply it
npx tackroom apply [dir]    Build and activate
npx tackroom update [dir]   Update pinned inputs, then apply
npx tackroom doctor [dir]   Report what is wired, missing or stale
```

Full documentation, the option surface and the design notes are in the
[repository](https://github.com/castrozan/tackroom).
