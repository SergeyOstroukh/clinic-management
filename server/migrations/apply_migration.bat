@echo off
echo ========================================
echo   Применение миграции на Railway
echo ========================================
echo.

REM Введите ваш DATABASE_URL из Railway
set /p DATABASE_URL="Вставьте DATABASE_URL из Railway: "

echo.
echo Применяю миграцию...
echo.

docker run --rm -v "%cd%:/migrations" postgres:15 psql "%DATABASE_URL%" -f /migrations/fix_column_names.sql

echo.
echo ========================================
echo   Миграция завершена!
echo ========================================
pause

