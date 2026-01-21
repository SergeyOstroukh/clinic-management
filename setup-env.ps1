# Скрипт для создания .env файла для локальной разработки
# Запустите: .\setup-env.ps1

$envContent = @"
# Database Configuration для локальной разработки с Docker
DATABASE_URL=postgresql://clinic_user:clinic_password@localhost:5432/clinic_db

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Initial Admin User
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin
"@

$envFile = ".env"

if (Test-Path $envFile) {
    Write-Host "Файл .env уже существует!" -ForegroundColor Yellow
    $overwrite = Read-Host "Перезаписать? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "Отменено." -ForegroundColor Yellow
        exit
    }
}

$envContent | Out-File -FilePath $envFile -Encoding utf8
Write-Host "Файл .env создан успешно!" -ForegroundColor Green
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Запустите Docker контейнер: docker-compose up -d" -ForegroundColor White
Write-Host "2. Запустите приложение: npm run dev" -ForegroundColor White
