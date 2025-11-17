# Применение миграции на Railway

## Способ 1: Через Web UI (проще)

1. Откройте Railway Dashboard
2. Перейдите в сервис **Postgres**
3. Откройте вкладку **Data** → нажмите **Connect** (справа вверху)
4. Откройте **Query** или используйте встроенный SQL редактор
5. Скопируйте команды из `fix_column_names.sql`
6. Выполните их

## Способ 2: Через Railway CLI

```bash
# Установите Railway CLI (если еще нет)
npm install -g @railway/cli

# Войдите в Railway
railway login

# Подключитесь к PostgreSQL и выполните миграцию
railway run psql $DATABASE_URL -f migrations/fix_column_names.sql
```

## Способ 3: Вручную через psql

1. Скопируйте DATABASE_URL из Railway
2. Выполните:
```bash
psql "postgresql://postgres:...@metro.proxy.rlwy.net:41155/railway" -f migrations/fix_column_names.sql
```

## После применения миграции:

✅ Перезапустите приложение на Railway (оно перезапустится автоматически после push)
✅ Проверьте что клиенты отображаются
✅ Данные сохранятся!

