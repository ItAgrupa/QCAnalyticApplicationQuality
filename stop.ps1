# Quality Intelligence Platform — Stop all services
Write-Host "Stopping Quality Intelligence Platform services..." -ForegroundColor Yellow

# Kill uvicorn (backend)
Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Backend stopped ✅"

# Kill node/npm (frontend)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "npm|vite" -or $_.CommandLine -match "vite"
} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Frontend stopped ✅"

Write-Host "PostgreSQL and Redis continue running as Windows services (they start automatically with Windows)."
Write-Host "Done."
