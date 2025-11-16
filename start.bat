@echo off
echo ====================================
echo Запуск системы управления клиникой
echo ====================================
echo.
echo Установка зависимостей...
call npm run install-all
echo.
echo Запуск сервера и клиента...
echo Откройте браузер: http://localhost:3000
echo.
call npm run dev

