# Quality Intelligence Platform — Stop all services

Write-Host ""
Write-Host "Stopping Quality Intelligence Platform..." -ForegroundColor Yellow

$stopped = 0

# Kill backend by port (more reliable than process name)
$back = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($back) {
    Stop-Process -Id $back.OwningProcess -Force -ErrorAction SilentlyContinue
    # Also kill any child python/uvicorn processes
    Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Backend stopped (port 8000)" -ForegroundColor Green
    $stopped++
} else {
    Write-Host "  Backend: not running" -ForegroundColor DarkGray
}

# Kill frontend by port
$front = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($front) {
    Stop-Process -Id $front.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "  Frontend stopped (port 5173)" -ForegroundColor Green
    $stopped++
} else {
    Write-Host "  Frontend: not running" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  PostgreSQL and Redis keep running as Windows services." -ForegroundColor DarkGray
Write-Host ""
if ($stopped -gt 0) {
    Write-Host "Done. $stopped service(s) stopped." -ForegroundColor Green
} else {
    Write-Host "Nothing was running." -ForegroundColor DarkGray
}
Write-Host ""
Start-Sleep 2
