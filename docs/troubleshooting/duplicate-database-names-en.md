# Two projects sharing the same Dolt database name

## Symptoms

You dropped a database from the central Dolt server — and another project lost its data. Or: `bd list` in project A shows issues from project B.

## Cause

Different projects can end up with the same `dolt_database` value in `metadata.json`. Example:

```
the-wedding-ru/  → dolt_database: "beads_the-wedding"
the-wedding-next/ → dolt_database: "beads_the-wedding"
```

Both projects read from and write to the same database. DROP DATABASE destroys data for both.

## ⚠️ How to check before any destructive operation

```bash
# 1. Find the database name for the current project
cat .beads/metadata.json | jq -r '.dolt_database'

# 2. Check if other projects use the same name
# Search all .beads/metadata.json files
find /path/to/repos -name metadata.json -path '*/.beads/*' \
  -exec grep -l "beads_the-wedding" {} \;
```

If more than one project is found — **do not drop the database from the central server**.

## How to prevent this

### When initializing a new project

Use a unique prefix:

```bash
# Bad — collides with another project
bd init --prefix the-wedding

# Good — unique names
bd init --prefix wedding-ru
bd init --prefix wedding-next
```

### When moving to per-project servers

With bd v0.59, each project stores its database locally in `.beads/dolt/`. Name collisions are impossible — databases are physically separated. This is the main argument for switching to per-project servers.

## If data is already lost

Check for backups:

```bash
# JSONL backup (if not overwritten by bd init --force)
ls .beads/backup/issues.jsonl

# Git history (beads commits to .beads/)
git log --oneline -- .beads/issues.jsonl

# External backup
ls ~/beads-backup-*/issues.jsonl
```

If no backups exist — data cannot be recovered. See "Back up first" in [jsonl-to-dolt-migration-en.md](jsonl-to-dolt-migration-en.md).
