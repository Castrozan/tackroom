---
name: commit
description: Write a commit message that explains why a change was made. Use when staging and committing work, or when a commit message needs rewriting.
---

# Commit

A commit message is read by someone trying to understand why the code looks the way it does.
The diff already says what changed, so the message spends its words on the reason.

## Shape

A subject line under 72 characters in the imperative mood, then a blank line, then prose that
names the problem the change solves. Conventional-commit prefixes are fine when the repository
already uses them; match what `git log` shows rather than importing a convention.

## What belongs in the body

The condition that made the change necessary, the constraint that ruled out the obvious
alternative, and anything a future reader would otherwise have to rediscover by experiment.
A message that only restates the diff in English is a message that could have been omitted.

## What does not

Attribution to the tool that wrote it, a summary of files touched, or a checklist of steps
already visible in the history.
