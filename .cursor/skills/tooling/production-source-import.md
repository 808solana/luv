---
name: production-source-import
description: Use when importing deployed source over SSH without copying secrets, runtime data, or rollback artifacts.
created: 2026-08-13
updated: 2026-08-13
tags: [ssh, production, import, sanitization, provenance]
---

# Production Source Import

## When to Use
- Importing a deployed tree into this repository for inspection or recovery.
- Verifying that host source corresponds to a running container.
- Don't use for deployment or any production mutation.

## Steps
1. Read `AGENT_MEMORY.md`, `PROJECT_CONTEXT.md`, and the governing phase plan.
2. Verify the local Git status, target-directory absence/state, SSH identity,
   remote source paths, remote Git status, and running container names before
   creating anything.
3. Inventory filenames and environment/config key names without printing
   values. Flag hardcoded credential-shaped literals before transfer.
4. Stream an archive over SSH. Exclude `.git`, live env/config, DB/WAL/SHM,
   runtime/customer data, logs, caches, virtualenvs, dependencies, builds,
   keys/certificates, backups, rollback files, captures, and generated results.
5. Apply deterministic redaction on the remote side before bytes reach local
   disk. Preserve file modes; do not preserve remote ownership.
6. Create placeholder-only `.env.example` and `config.example.*` files when a
   safe template does not exist.
7. Record source commit/tree, dirty-patch hash, container image, host/container
   content hashes, exclusions, and redactions.
8. Add ignore rules for every excluded class before running checks.
9. Run layered secret scans plus no-secret syntax/packaging checks. Re-check Git
   status to prove unrelated user files were preserved.

## Pitfalls
- Local `rsync` may be unavailable even when the server has it. A streamed tar
  avoids installing tools and does not stage an intermediate archive.
- A combined manifest hash differs if `sha256sum` records different path
  prefixes. Compare corresponding per-file hashes or hash normalized records.
- A running image can differ from the host checkout. Compare container files
  directly; a host Git revision alone is not deployment proof.
- Redacted source may be intentionally non-runnable. Document the secret
  injection boundary instead of adding fake credentials to executable config.
- Broad backup globs must catch suffixes such as `.bak-style`, not only `.bak`.

## Verification
- [ ] Production received no writes, restarts, rebuilds, or DB operations.
- [ ] Host and container source correspondence is evidenced.
- [ ] Local normalized hashes match remote normalized hashes.
- [ ] Secret scans find no live credentials or private keys.
- [ ] No DB, WAL/SHM, env, log, cache, build, rollback, or generated data is present.
- [ ] Python/shell/JSON/Compose checks pass without live secrets.
- [ ] Existing `web/` and pre-existing user changes remain untouched.

## Usage
- 2026-08-13: Imported deployed LUV13 API and dirty proxy trees through `kor`.
