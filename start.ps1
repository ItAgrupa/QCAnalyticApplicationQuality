# Quality Intelligence Platform — Start all services
# Run this script any time you want to start the project

Write-Host "======================================" -ForegroundColor Green
Write-Host "  Quality Intelligence Platform" -ForegroundColor Green
Write-Host "  Starting all services..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"

$ROOT = $PSScriptRoot

# ── 1. PostgreSQL ─────────────────────────────────────────────────────────────
$pgSvc = Get-Service "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pgSvc -and $pgSvc.Status -ne "Running") {
    Write-Host "[1/4] Starting PostgreSQL..." -ForegroundColor Cyan
    Start-Service "postgresql-x64-16"
    Start-Sleep 2
} else {
    Write-Host "[1/4] PostgreSQL: already running ✅" -ForegroundColor Green
}

# ── 2. Redis ──────────────────────────────────────────────────────────────────
$redisSvc = Get-Service "Redis" -ErrorAction SilentlyContinue
if ($redisSvc -and $redisSvc.Status -ne "Running") {
    Write-Host "[2/4] Starting Redis..." -ForegroundColor Cyan
    Start-Service "Redis"
    Start-Sleep 1
} else {
    Write-Host "[2/4] Redis: already running ✅" -ForegroundColor Green
}

# ── 3. Backend (FastAPI) ──────────────────────────────────────────────────────
Write-Host "[3/4] Starting FastAPI backend..." -ForegroundColor Cyan
$backendEnv = @{
    POSTGRES_HOST        = "localhost"
    POSTGRES_PORT        = "5432"
    POSTGRES_DB          = "quality_platform"
    POSTGRES_USER        = "qp_user"
    POSTGRES_PASSWORD    = "qp_dev_password_2026"
    SECRET_KEY           = "dev_secret_key_replace_in_production_must_be_64_chars_minimum_abc123"
    UPLOAD_DIR           = "$ROOT\storage\uploads"
    EXPORT_DIR           = "$ROOT\storage\exports"
    CORS_ORIGINS         = "http://localhost:5173,http://192.168.1.133:5173"
    REDIS_URL            = "redis://localhost:6379/0"
    CELERY_BROKER_URL    = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND= "redis://localhost:6379/2"
    SMTP_HOST            = "smtp.gmail.com"
    SMTP_PORT            = "587"
    SMTP_USER            = "itagrupamagopco@gmail.com"
    SMTP_PASSWORD        = ""
    FROM_EMAIL           = "itagrupamagopco@gmail.com"
    APP_URL              = "http://192.168.1.133:5173"
    LOG_LEVEL            = "INFO"
    ENVIRONMENT          = "development"
    APP_NAME             = "Quality Intelligence Platform"
    APP_VERSION          = "1.0.0"
}

Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ROOT\backend'; " +
    ($backendEnv.GetEnumerator() | ForEach-Object { "`$env:$($_.Key)='$($_.Value)'; " }) +
    ".\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"
) -WindowStyle Normal

Start-Sleep 4

# ── 4. Frontend (Vite) ────────────────────────────────────────────────────────
Write-Host "[4/4] Starting Vite frontend..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-Command",
    "$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); cd '$ROOT\frontend'; npm run dev"
) -WindowStyle Normal

Start-Sleep 5

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs:  http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login with:" -ForegroundColor Yellow
Write-Host "  Email:    admin@quality.com" -ForegroundColor Yellow
Write-Host "  Password: Admin1234!" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Green

# Open browser
Start-Process "http://localhost:5173"
