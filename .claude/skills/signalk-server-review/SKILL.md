---
name: signalk-server-review
description: Review a Signal K server change against REVIEW.md, the review rules from the maintainers' own reviews. Use before asking for review on your own branch or PR, and to review someone else's branch or PR.
---

# Review a Signal K server change

## Scope

- Review the full change against the target branch: the branch's commits plus anything uncommitted. Resolve the base (prefer `upstream/master`, then `origin/master`, then `master`) and review `git diff "$(git merge-base <base> HEAD)"`.
- For a GitHub PR, read the description with `gh pr view` and the diff with `gh pr diff`.

## Check

1. Read the whole diff, the PR description and the commit messages.
2. Go through every rule in `REVIEW.md`. For each rule, find where in the change it applies, or skip it. The example under each rule shows what it means in practice.
3. Also check `AGENTS.md`, `CONTRIBUTING.md` and the PR template.
4. For a PR that already has review comments, check that each one has been addressed, and list the ones that haven't.

## Verify

- Before reporting a finding, check it against the code: read the code the change builds on, not only the diff.
- A suggested fix must itself follow `REVIEW.md` and pass lint.

## Report

- Per finding: the file and line, the rule from `REVIEW.md` it breaks, and what to change.
- Leave out rules the change already meets, and style points that lint catches.
- Report in the console only. Do not post to GitHub unless asked.
