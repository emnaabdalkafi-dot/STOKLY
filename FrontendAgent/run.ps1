#!/usr/bin/env pwsh
# STOKLY Agent - Run script for CPH2325
# Usage: .\run.ps1 [release|profile]

param (
    [string]$Mode = "release"
)

if ($Mode -ne "release" -and $Mode -ne "profile") {
    Write-Host "Usage: .\run.ps1 [release|profile]" -ForegroundColor Yellow
    Write-Host "  release - Fast, no DevTools (recommended for CPH2325)" -ForegroundColor Cyan
    Write-Host "  profile - AOT compiled + DevTools (for debugging)" -ForegroundColor Cyan
    exit 1
}

Write-Host "Starting STOKLY Agent in $Mode mode on CPH2325..." -ForegroundColor Green
flutter run --$Mode -d CPH2325
