# Run this ONCE to create a desktop shortcut for the Quality Intelligence Platform.
# After running it, you can start the app by double-clicking the desktop icon.

$ROOT    = $PSScriptRoot
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$Shell   = New-Object -ComObject WScript.Shell

# ── Main launcher shortcut ────────────────────────────────────────────────────
$sc = $Shell.CreateShortcut("$Desktop\Quality Platform.lnk")
$sc.TargetPath       = "wscript.exe"
$sc.Arguments        = """$ROOT\launch.vbs"""
$sc.WorkingDirectory = $ROOT
$sc.Description      = "Start the Quality Intelligence Platform"
$sc.IconLocation     = "shell32.dll,14"   # globe / web icon
$sc.Save()
Write-Host "Created: 'Quality Platform' on Desktop" -ForegroundColor Green

# ── Stop shortcut ─────────────────────────────────────────────────────────────
$sc2 = $Shell.CreateShortcut("$Desktop\Stop Quality Platform.lnk")
$sc2.TargetPath       = "powershell.exe"
$sc2.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ROOT\stop.ps1"""
$sc2.WorkingDirectory = $ROOT
$sc2.Description      = "Stop the Quality Intelligence Platform"
$sc2.IconLocation     = "shell32.dll,131"  # red X / stop icon
$sc2.Save()
Write-Host "Created: 'Stop Quality Platform' on Desktop" -ForegroundColor Green

Write-Host ""
Write-Host "Setup complete! You now have two desktop icons:" -ForegroundColor Cyan
Write-Host "  'Quality Platform'       - double-click to START" -ForegroundColor White
Write-Host "  'Stop Quality Platform'  - double-click to STOP" -ForegroundColor White
Write-Host ""
Start-Sleep 3
