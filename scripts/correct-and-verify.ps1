$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PostCraft AI - Correct and Verify" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testFile = ".\tests\e2e\verification.spec.ts"
$gitignoreFile = ".\.gitignore"

# --------------------------------------------------
# 1. Correct Playwright imports and Page type
# --------------------------------------------------

Write-Host "[1/5] Correcting Playwright test file..." -ForegroundColor Yellow

if (Test-Path $testFile) {
    $content = Get-Content $testFile -Raw

    # Remove every existing @playwright/test import line
    $content = [regex]::Replace(
        $content,
        '(?m)^\s*import\s+\{[^}]*\}\s+from\s+[''"]@playwright/test[''"];\s*\r?\n?',
        ''
    )

    # Add exactly one correct import
    $content = 'import { test, expect, type Page } from "@playwright/test";' + "`r`n`r`n" + $content.TrimStart()

    # Correct the helper function parameter
    $content = [regex]::Replace(
        $content,
        'async function runVerification\(\s*page\s*,\s*url:\s*string\s*\)',
        'async function runVerification(page: Page, url: string)'
    )

    Set-Content -Path $testFile -Value $content -Encoding UTF8

    Write-Host "  Playwright import and Page type corrected." -ForegroundColor Green
}
else {
    Write-Host "  File not found: $testFile" -ForegroundColor Red
}

# --------------------------------------------------
# 2. Update .gitignore
# --------------------------------------------------

Write-Host ""
Write-Host "[2/5] Updating .gitignore..." -ForegroundColor Yellow

if (-not (Test-Path $gitignoreFile)) {
    New-Item -ItemType File -Path $gitignoreFile -Force | Out-Null
}

$gitignore = Get-Content $gitignoreFile -Raw

$entriesToAdd = @(
    "test-results/",
    "playwright-report/",
    "tsconfig.tsbuildinfo"
)

foreach ($entry in $entriesToAdd) {
    if ($gitignore -notmatch [regex]::Escape($entry)) {
        Add-Content -Path $gitignoreFile -Value $entry
        Write-Host "  Added: $entry" -ForegroundColor Green
    }
    else {
        Write-Host "  Already present: $entry" -ForegroundColor Gray
    }
}

# --------------------------------------------------
# 3. Display corrected file header
# --------------------------------------------------

Write-Host ""
Write-Host "[3/5] Checking corrected test file..." -ForegroundColor Yellow

Get-Content $testFile -TotalCount 12

# --------------------------------------------------
# 4. TypeScript validation
# --------------------------------------------------

Write-Host ""
Write-Host "[4/5] Running TypeScript validation..." -ForegroundColor Yellow

npx tsc --noEmit

if ($LASTEXITCODE -eq 0) {
    Write-Host "  TypeScript validation passed." -ForegroundColor Green
}
else {
    Write-Host "  TypeScript validation failed." -ForegroundColor Red
}

# --------------------------------------------------
# 5. Production build
# --------------------------------------------------

Write-Host ""
Write-Host "[5/5] Running production build..." -ForegroundColor Yellow

npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Production build passed." -ForegroundColor Green
}
else {
    Write-Host "  Production build failed." -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Final Git Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

git status --short

Write-Host ""
Write-Host "Correction and verification completed." -ForegroundColor Cyan
