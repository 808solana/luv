---
name: source-backup
description: Use when the user asks to backup, snapshot, or save the current luv source before changes. Creates a git branch/tag plus a local archive; does not invent a second remote if origin exists.
created: 2026-08-24
updated: 2026-08-24
tags: [backup, git, tooling]
---

# Source backup before changes

## When to Use
- User wants a restore point before editing
- Don't use when: they asked for a feature commit, force-push, or a public share

## Steps
1. Read git status, remotes, and HEAD. Do not force-push, hard-reset, skip hooks, or change git config.
2. If `origin` already exists, do not create a Cursor-hosted second copy (share skill). Named local refs are still useful.
3. Create `backup/pre-changes-YYYY-MM-DD` as a branch **and** an annotated tag at current HEAD. Stay on the current branch (`git branch`, do not switch).
4. Do not commit unless uncommitted work would otherwise be lost **and** a commit is the only safe path. Prefer: named stash **plus** an archive (stash can be dropped).
5. Write a timestamped tar.gz under `/Users/real/luv-backups/` from the working tree. Exclude `.git`, `node_modules`, `.next`, `.env*`, keys/certs, DBs, `__pycache__`, venvs, `dist`/`build`. Set `COPYFILE_DISABLE=1` on macOS. Do not include secrets.
6. If the working tree is dirty, also `git stash push -u -m "backup/pre-changes-YYYY-MM-DD"` **after** the archive exists.
7. Push only a clearly named backup branch/tag if extra off-machine safety is needed. Never push to `main` as the backup action. Skip push if `origin/main` already has this commit and the user did not ask to publish.
8. Leave a `RESTORE-YYYY-MM-DD.txt` next to the archive with restore commands.

## Pitfalls
- Share skill: existing remote means the project is already saved there — do not `origin repo create` a duplicate.
- BSD `tar --exclude='data'` does not skip nested `api/data/`; empty dirs are OK, but never pack `*.db`.
- Annotated tags have a different object hash than the commit; restore via the tag **name**.
- Branch and tag with the same short name make `git log backup/pre-changes-DATE` ambiguous. Restore with `refs/heads/...` or `refs/tags/...`.

## Verification
- [ ] `git show-ref` shows both `refs/heads/backup/pre-changes-YYYY-MM-DD` and `refs/tags/backup/pre-changes-YYYY-MM-DD`
- [ ] Archive exists under `/Users/real/luv-backups/` and `tar -tzf` has no `.env` / `*.pem` / `*.key`
- [ ] `git status` still on the original branch

## Usage
- count: 1
