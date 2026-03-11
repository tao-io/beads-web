# Два проекта с одним именем Dolt-базы

## Симптомы

Удалили базу с центрального Dolt-сервера — пропали данные другого проекта. Или: `bd list` в проекте A показывает задачи проекта B.

## Причина

Разные проекты могут получить одинаковое значение `dolt_database` в `metadata.json`. Пример:

```
the-wedding-ru/  → dolt_database: "beads_the-wedding"
the-wedding-next/ → dolt_database: "beads_the-wedding"
```

Оба проекта читают и пишут в одну базу. DROP DATABASE уничтожает данные обоих.

## ⚠️ Как проверить перед любой опасной операцией

```bash
# 1. Узнайте имя базы текущего проекта
cat .beads/metadata.json | jq -r '.dolt_database'

# 2. Проверьте — нет ли других проектов с таким же именем
# Поиск по всем .beads/metadata.json на диске
find /path/to/repos -name metadata.json -path '*/.beads/*' \
  -exec grep -l "beads_the-wedding" {} \;
```

Если найдено больше одного проекта — **не удаляйте базу с центрального сервера**.

## Как избежать

### При инициализации нового проекта

Используйте уникальный prefix:

```bash
# Плохо — совпадает с другим проектом
bd init --prefix the-wedding

# Хорошо — уникальное имя
bd init --prefix wedding-ru
bd init --prefix wedding-next
```

### При переходе на per-project серверы

С bd v0.59 каждый проект хранит базу локально в `.beads/dolt/`. Конфликт имён невозможен — базы физически разделены. Это основной аргумент за переход на per-project серверы.

## Если данные уже потеряны

Проверьте резервные копии:

```bash
# JSONL-бэкап (если не перезаписан bd init --force)
ls .beads/backup/issues.jsonl

# Git-история (beads коммитит в .beads/)
git log --oneline -- .beads/issues.jsonl

# Внешний бэкап
ls ~/beads-backup-*/issues.jsonl
```

Если бэкапов нет — данные не восстановить. См. раздел "Сначала — бэкап" в [jsonl-to-dolt-migration-ru.md](jsonl-to-dolt-migration-ru.md).
