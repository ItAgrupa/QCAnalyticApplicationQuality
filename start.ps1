# Quality Intelligence Platform — Start all services
# Run this script (or double-click the desktop shortcut) to launch the app.

$ROOT = $PSScriptRoot

# Refresh PATH so postgres/node are found regardless of install order
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\Program Files\PostgreSQL\16\bin"

# ── Detect LAN IP ─────────────────────────────────────────────────────────────
$LAN_IP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
    Select-Object -First 1).IPAddress
if (-not $LAN_IP) { $LAN_IP = "localhost" }

Write-Host ""
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host "   Quality Intelligence Platform" -ForegroundColor White
Write-Host "   Starting services..." -ForegroundColor Gray
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host ""

# ── 1. PostgreSQL ─────────────────────────────────────────────────────────────
$pgSvc = Get-Service "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pgSvc -and $pgSvc.Status -ne "Running") {
    Write-Host "[1/5] Starting PostgreSQL..." -ForegroundColor Cyan
    Start-Service "postgresql-x64-16"
    Start-Sleep 2
} else {
    Write-Host "[1/5] PostgreSQL: already running" -ForegroundColor Green
}

# ── 2. Redis ──────────────────────────────────────────────────────────────────
$redisSvc = Get-Service "Redis" -ErrorAction SilentlyContinue
if ($redisSvc -and $redisSvc.Status -ne "Running") {
    Write-Host "[2/5] Starting Redis..." -ForegroundColor Cyan
    Start-Service "Redis"
    Start-Sleep 1
} elseif ($redisSvc) {
    Write-Host "[2/5] Redis: already running" -ForegroundColor Green
} else {
    Write-Host "[2/5] Redis: not installed (optional, skipping)" -ForegroundColor DarkGray
}

# ── 3. Windows Firewall — open ports for LAN access ──────────────────────────
# Profile "Any" covers Domain, Private AND Public networks.
# Without this, Windows blocks the ports when the Wi-Fi is classified as Public.
Write-Host "[3/5] Configuring firewall for LAN access..." -ForegroundColor Cyan

$rules = @(
    @{ Name = "QIP Backend API (8000)"; Port = 8000 },
    @{ Name = "QIP Frontend (5173)";    Port = 5173 }
)
foreach ($r in $rules) {
    $exists = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
    if ($exists) {
        # Rule already exists — make sure it covers all network profiles (including Public)
        Set-NetFirewallRule -DisplayName $r.Name -Profile Any -ErrorAction SilentlyContinue
    } else {
        New-NetFirewallRule -DisplayName $r.Name `
            -Direction Inbound -Protocol TCP -LocalPort $r.Port `
            -Action Allow -Profile Any `
            -ErrorAction SilentlyContinue | Out-Null
        Write-Host "    Opened port $($r.Port) in firewall" -ForegroundColor DarkGray
    }
}
Write-Host "    Firewall: OK (all network profiles)" -ForegroundColor Green

# ── 4. Backend (FastAPI / uvicorn) ────────────────────────────────────────────
$backendRunning = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($backendRunning) {
    Write-Host "[4/5] Backend: already running on port 8000" -ForegroundColor Green
} else {
    Write-Host "[4/5] Starting FastAPI backend..." -ForegroundColor Cyan

    $backendEnv = @{
        POSTGRES_HOST         = "localhost"
        POSTGRES_PORT         = "5432"
        POSTGRES_DB           = "quality_platform"
        POSTGRES_USER         = "qp_user"
        POSTGRES_PASSWORD     = "qp_dev_password_2026"
        SECRET_KEY            = "dev_secret_key_replace_in_production_must_be_64_chars_minimum_abc123"
        UPLOAD_DIR            = "$ROOT\storage\uploads"
        EXPORT_DIR            = "$ROOT\storage\exports"
        CORS_ORIGINS          = "http://localhost:5173,http://${LAN_IP}:5173"
        REDIS_URL             = "redis://localhost:6379/0"
        CELERY_BROKER_URL     = "redis://localhost:6379/1"
        CELERY_RESULT_BACKEND = "redis://localhost:6379/2"
        SMTP_HOST             = "smtp.gmail.com"
        SMTP_PORT             = "587"
        SMTP_USER             = "itagrupamagopco@gmail.com"
        SMTP_PASSWORD         = ""
        FROM_EMAIL            = "itagrupamagopco@gmail.com"
        APP_URL               = "http://${LAN_IP}:5173"
        LOG_LEVEL             = "INFO"
        ENVIRONMENT           = "development"
        APP_NAME              = "Quality Intelligence Platform"
        APP_VERSION           = "1.0.0"
    }

    $envBlock = ($backendEnv.GetEnumerator() | ForEach-Object { "`$env:$($_.Key)='$($_.Value)'; " }) -join ""

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$ROOT\backend'; $envBlock" +
        ".\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"
    ) -WindowStyle Minimized
}

# ── 5. Frontend (Vite) ────────────────────────────────────────────────────────
$frontendRunning = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($frontendRunning) {
    Write-Host "[5/5] Frontend: already running on port 5173" -ForegroundColor Green
} else {
    Write-Host "[5/5] Starting Vite frontend..." -ForegroundColor Cyan

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-Command",
        "$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + " +
        "[System.Environment]::GetEnvironmentVariable('Path','User'); " +
        "Set-Location '$ROOT\frontend'; npm run dev"
    ) -WindowStyle Minimized
}

# ── Wait for services to be ready ─────────────────────────────────────────────
Write-Host ""
Write-Host "Waiting for services to be ready..." -ForegroundColor Gray
$timeout = 30
$elapsed = 0
$backOk = $false
$frontOk = $false

while ($elapsed -lt $timeout) {
    Start-Sleep 2
    $elapsed += 2
    if (-not $backOk)  { $backOk  = [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) }
    if (-not $frontOk) { $frontOk = [bool](Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) }
    if ($backOk -and $frontOk) { break }
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host "  READY" -ForegroundColor $(if ($backOk -and $frontOk) { "Green" } else { "Yellow" })
Write-Host ""
Write-Host "  On this computer:" -ForegroundColor White
Write-Host "    http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  From any laptop on the same Wi-Fi / network:" -ForegroundColor White
Write-Host "    http://${LAN_IP}:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login:  admin@quality.com  /  Admin1234!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  To stop the app: run stop.ps1 (or close the" -ForegroundColor DarkGray
Write-Host "  two minimised PowerShell windows in the taskbar)" -ForegroundColor DarkGray
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host ""

# Open browser on this machine
if ($backOk -and $frontOk) {
    Start-Process "http://localhost:5173"
} else {
    Write-Host "WARNING: One or more services may not have started." -ForegroundColor Red
    Write-Host "Check the minimised PowerShell windows in the taskbar for errors." -ForegroundColor Red
}
