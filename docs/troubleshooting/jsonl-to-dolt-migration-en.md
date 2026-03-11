# Migrating beads from JSONL to Dolt

## Symptoms

You upgraded to bd v0.59. `bd list` returns 0 issues. Your old issues are still in `.beads/issues.jsonl`, but bd ignores them. The Dolt database is empty.

bd v0.59 switched to Dolt as the only backend. There is no automatic migration from JSONL.

## ⚠️ Back up first

**Before doing anything — copy your data outside of `.beads/`.**

```bash
# Copy ALL beads data to a safe location
cp -r .beads/ ~/beads-backup-$(basename "$PWD")-$(date +%Y%m%d)/

# Verify the backup exists
ls ~/beads-backup-*/issues.jsonl
```

Why this matters:
- `bd init --force` deletes `.beads/dolt/` **and** `.beads/backup/` with no recovery
- `bd init` overwrites `metadata.json` — old settings are gone
- If anything goes wrong, only an external copy can save your data

**Do not skip this step. Lost data cannot be recovered.**

## What doesn't work

### bd backup restore — field type bug

```bash
bd backup restore .beads/backup/
# Reports "8 restored", but bd list shows 0
```

Root cause: arrays and nested objects from JSONL fail to insert into the Dolt table. The command silently drops errors.

### bd import — doesn't exist

```bash
bd import -i .beads/issues.jsonl
# Error: unknown command "import" for "bd"
```

The command appears in main-branch docs but is missing from the v0.59.0 release.

### migrate-jsonl-to-dolt.sh — missing dependencies

The script at `scripts/migrate-jsonl-to-dolt.sh` in the beads repo requires `mysql` CLI or `dolt sql-client`. Neither ships with a standard bd + dolt installation.

## Working solution: bd sql via Node.js

### Step 1. Verify your backup

```bash
ls ~/beads-backup-*/issues.jsonl
# If the file is missing — go back to "Back up first"
```

### Step 2. Initialize Dolt

```bash
bd init --prefix myproject
```

If `.beads/` already has an old configuration, remove only `metadata.json` and `dolt/`:

```bash
rm -f .beads/metadata.json
rm -rf .beads/dolt
bd init --prefix myproject
```

### Step 3. Create a dummy issue to initialize the schema

`bd init` creates an empty `.beads/dolt/` directory with no tables. Tables appear after the first write:

```bash
bd create --title="Init" -d "Temporary" --type task --priority 4
# Note the ID (e.g., myproject-a1b)
```

Verify:

```bash
bd sql "SELECT COUNT(*) FROM issues"
# Should return 1
```

### Step 4. Run the import

Save as `import-jsonl.cjs` in your project root:

```javascript
const fs = require('fs');
const { execFileSync } = require('child_process');

const file = process.argv[2] || '.beads/issues.jsonl';
const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
let ok = 0, fail = 0;

for (const line of lines) {
  const row = JSON.parse(line);
  const esc = (v) => v == null ? '' : String(v).replace(/'/g, "''");
  const closed_at = row.closed_at ? "'" + esc(row.closed_at) + "'" : 'NULL';

  const sql =
    'INSERT IGNORE INTO issues (id, title, description, design, ' +
    'acceptance_criteria, notes, status, priority, issue_type, owner, ' +
    'created_by, created_at, updated_at, closed_at, close_reason) VALUES (' +
    "'" + esc(row.id) + "', " +
    "'" + esc(row.title) + "', " +
    "'" + esc(row.description) + "', '', '', '', " +
    "'" + esc(row.status) + "', " +
    (row.priority ?? 2) + ', ' +
    "'" + esc(row.issue_type) + "', " +
    "'" + esc(row.owner) + "', " +
    "'" + esc(row.created_by) + "', " +
    "'" + esc(row.created_at) + "', " +
    "'" + esc(row.updated_at) + "', " +
    closed_at + ', ' +
    "'" + esc(row.close_reason) + "')";

  try {
    execFileSync('bd', ['sql', sql], { stdio: 'pipe' });
    ok++;
    console.log('OK:', row.id);
  } catch (e) {
    fail++;
    console.error('FAIL:', row.id, '-',
      e.stderr?.toString().trim().slice(0, 120));
  }
}

console.log(`\nDone: ${ok} imported, ${fail} failed`);
```

Run:

```bash
node import-jsonl.cjs .beads/issues.jsonl
```

Or from a backup:

```bash
node import-jsonl.cjs ~/beads-backup-myproject-20260311/issues.jsonl
```

### Step 5. Clean up

```bash
bd close myproject-a1b --reason "temporary init issue"
rm import-jsonl.cjs
```

### Step 6. Verify

```bash
bd sql "SELECT COUNT(*) FROM issues"
bd sql "SELECT status, COUNT(*) FROM issues GROUP BY status"
```

## Technical details

**Why `execFileSync` instead of `execSync`?** `execSync` passes SQL through the shell. Cyrillic, quotes, and special characters in descriptions break bash escaping. `execFileSync` calls `bd` directly, bypassing the shell.

**Why 15 columns out of 53?** Old-format JSONL stores 12 fields. The Dolt issues table has 53 columns. The remaining 38 — molecules, agents, gates — are filled with defaults.

**Why `INSERT IGNORE`?** Re-running the script skips already-imported records instead of failing on duplicates.

**Why `.cjs`, not `.js`?** Projects with `"type": "module"` in `package.json` treat `.js` as ESM. The script uses `require()` — it needs the `.cjs` extension.

## Gotchas

| Situation | What happens | Fix |
|-----------|-------------|-----|
| `bd init --force` | Deletes `.beads/dolt/` and `.beads/backup/` | Back up outside `.beads/` before any init |
| `bd init` without `bd create` | `.beads/dolt/` empty, no tables | Run `bd create` to initialize the schema |
| Dolt server unreachable on 3307 | Per-project server not started | Any bd command (`bd list`) starts it automatically |
| `bd list` empty after import | All issues have `closed` status | Normal — `bd list` only shows `open` by default |
| Script crashes on Cyrillic text | `execSync` breaks unicode via shell | Use `execFileSync` |

## Tested with

- bd v0.59.0, dolt v1.83.4, Node.js v22, Windows 11
- Successfully migrated: 17 issues (Yandex-webmaster) and 63 issues (wifi-pentest-ai)
