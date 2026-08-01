# Uninstalls the JARVIS client (jarvis-hud Electron overlay) from a Windows
# laptop. Run this ON the client machine - see uninstall/uninstall-server.sh
# for the mini PC / backend side.
#
# Usage (from an elevated or normal PowerShell prompt):
#   .\uninstall-client.ps1                # interactive, asks for confirmation
#   .\uninstall-client.ps1 -Force         # skip confirmation

param(
    [switch]$Force,
    [string]$RepoDir = "$env:USERPROFILE\jarvis-ai-assistant"
)

$StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

Write-Host "This will remove the JARVIS client from this machine:"
Write-Host "  Repo folder    : $RepoDir"
Write-Host "  Startup shortcut(s) referencing jarvis, if any, in: $StartupDir"
Write-Host ""

if (-not $Force) {
    $reply = Read-Host "Continue? [y/N]"
    if ($reply -notmatch '^[Yy]$') {
        Write-Host "Aborted."
        exit 1
    }
}

Write-Host "==> Stopping any running JARVIS overlay (electron.exe under the repo folder)"
Get-Process electron -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($RepoDir, [System.StringComparison]::OrdinalIgnoreCase) } |
    Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "==> Removing startup shortcuts referencing jarvis"
Get-ChildItem -Path $StartupDir -Filter "*.lnk" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "(?i)jarvis" } |
    ForEach-Object {
        Write-Host "    removing $($_.FullName)"
        Remove-Item $_.FullName -Force
    }

Write-Host "==> Removing repo folder ($RepoDir)"
if (Test-Path $RepoDir) {
    Remove-Item -Path $RepoDir -Recurse -Force
} else {
    Write-Host "    (not found, skipping)"
}

Write-Host ""
Write-Host "Client-side cleanup done. This only cleaned this laptop - run"
Write-Host "uninstall/uninstall-server.sh on the mini PC to remove the"
Write-Host "OpenJarvis backend, Ollama models, and jarvis-tts service too."
