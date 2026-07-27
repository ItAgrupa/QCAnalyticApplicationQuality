' Quality Intelligence Platform ? Desktop Launcher
' This file starts the app silently (no terminal window).
' Double-click it, or use the desktop shortcut.

Dim objShell, strRoot, strScript
Set objShell = CreateObject("WScript.Shell")

strRoot = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
strScript = strRoot & "\start.ps1"

objShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & strScript & """", 0, False

Set objShell = Nothing
