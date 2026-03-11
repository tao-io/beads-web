# Миграция beads из JSONL в Dolt

## Симптомы

Обновились до bd v0.59. Запускаете `bd list` — 0 задач. Старые issues лежат в `.beads/issues.jsonl`, но bd их не видит. Dolt-база пустая.

bd v0.59 перешёл на Dolt как единственный бэкенд. Автоматической миграции из JSONL нет.

## ⚠️ Сначала — бэкап

**Прежде чем делать что-либо — скопируйте данные за пределы `.beads/`.**

```bash
# Скопируйте ВСЕ данные beads в безопасное место
cp -r .beads/ ~/beads-backup-$(basename "$PWD")-$(date +%Y%m%d)/

# Убедитесь что копия на месте
ls ~/beads-backup-*/issues.jsonl
```

Почему это критично:
- `bd init --force` удаляет `.beads/dolt/` **и** `.beads/backup/` без возможности восстановления
- `bd init` перезаписывает `metadata.json` — старые настройки пропадут
- Если что-то пойдёт не так, восстановить данные можно только из внешней копии

**Не пропускайте этот шаг. Потерянные данные не вернуть.**

## Что не работает

### bd backup restore — баг с типами полей

```bash
bd backup restore .beads/backup/
# Выводит "8 restored", но bd list показывает 0
```

Причина: массивы и вложенные объекты из JSONL не вставляются в Dolt-таблицу. Команда молча пропускает ошибки.

### bd import — не существует

```bash
bd import -i .beads/issues.jsonl
# Error: unknown command "import" for "bd"
```

Команда есть в документации на main-ветке, но отсутствует в релизе v0.59.0.

### migrate-jsonl-to-dolt.sh — нет зависимостей

Скрипт `scripts/migrate-jsonl-to-dolt.sh` из репозитория beads требует `mysql` CLI или `dolt sql-client`. Ни то, ни другое не входит в стандартную установку bd + dolt.

## Рабочее решение: bd sql через Node.js

### Шаг 1. Убедитесь что бэкап сделан

```bash
ls ~/beads-backup-*/issues.jsonl
# Если файла нет — вернитесь к разделу "Сначала — бэкап"
```

### Шаг 2. Инициализируйте Dolt

```bash
bd init --prefix myproject
```

Если `.beads/` уже содержит старую конфигурацию, удалите только `metadata.json` и `dolt/`:

```bash
rm -f .beads/metadata.json
rm -rf .beads/dolt
bd init --prefix myproject
```

### Шаг 3. Создайте первый issue для инициализации схемы

`bd init` создаёт пустую директорию `.beads/dolt/` без таблиц. Таблицы появляются после первой записи:

```bash
bd create --title="Init" -d "Temporary" --type task --priority 4
# Запомните ID (например, myproject-a1b)
```

Проверьте что таблица создана:

```bash
bd sql "SELECT COUNT(*) FROM issues"
# Должен вернуть 1
```

### Шаг 4. Импортируйте данные

Сохраните как `import-jsonl.cjs` в корне проекта:

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

Запуск:

```bash
node import-jsonl.cjs .beads/issues.jsonl
```

Если файл в другом месте (бэкап):

```bash
node import-jsonl.cjs ~/beads-backup-myproject-20260311/issues.jsonl
```

### Шаг 5. Удалите временный issue и скрипт

```bash
bd close myproject-a1b --reason "temporary init issue"
rm import-jsonl.cjs
```

### Шаг 6. Проверьте результат

```bash
bd sql "SELECT COUNT(*) FROM issues"
bd sql "SELECT status, COUNT(*) FROM issues GROUP BY status"
```

## Технические детали

**Почему `execFileSync`, а не `execSync`?** `execSync` передаёт SQL через shell. Кириллица, кавычки и спецсимволы в описаниях ломают bash escaping. `execFileSync` вызывает `bd` напрямую, минуя shell.

**Почему 15 колонок из 53?** JSONL старого формата хранит 12 полей. Таблица issues в Dolt содержит 53 колонки. Остальные 38 — новые фичи (molecules, agents, gates) — заполняются дефолтами.

**Почему `INSERT IGNORE`?** При повторном запуске скрипт пропустит уже импортированные записи вместо ошибки дублирования.

**Файл `.cjs`, не `.js`?** Проекты с `"type": "module"` в `package.json` трактуют `.js` как ESM. Скрипт использует `require()` — нужно расширение `.cjs`.

## Подводные камни

| Ситуация | Что происходит | Что делать |
|----------|---------------|------------|
| `bd init --force` | Удаляет `.beads/dolt/` и `.beads/backup/` | Бэкап за пределами `.beads/` перед любым init |
| `bd init` без `bd create` | `.beads/dolt/` пустая, нет таблиц | `bd create` — создаст схему |
| Dolt server unreachable 3307 | Per-project сервер не запущен | Любая bd-команда (`bd list`) стартует сервер автоматически |
| `bd list` пуст после импорта | Все issues в статусе `closed` | Нормально — `bd list` показывает только `open` |
| Скрипт падает на кириллице | `execSync` ломает unicode через shell | Используйте `execFileSync` |

## Проверено на

- bd v0.59.0, dolt v1.83.4, Node.js v22, Windows 11
- Успешно мигрировано: 17 issues (Yandex-webmaster) и 63 issues (wifi-pentest-ai)
