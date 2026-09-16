$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PostCraft AI - Verify and Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Get-Location
$testFile = Join-Path $projectRoot "tests\e2e\verification.spec.ts"
$gitignoreFile = Join-Path $projectRoot ".gitignore"

# --------------------------------------------------
# 1. Fix Playwright Page type
# --------------------------------------------------

Write-Host "[1/5] Checking Playwright test file..." -ForegroundColor Yellow

if (Test-Path $testFile) {
    $content = Get-Content $testFile -Raw

    if ($content -notmatch "type Page") {
        if ($content -match 'import\s+\{\s*test,\s*expect\s*\}\s+from\s+"@playwright/test";') {
            $content = $content -replace `
                'import\s+\{\s*test,\s*expect\s*\}\s+from\s+"@playwright/test";', `
                'import { test, expect, type Page } from "@playwright/test";'
        }
        elseif ($content -match 'import\s+\{\s*test\s*\}\s+from\s+"@playwright/test";') {
            $content = $content -replace `
                'import\s+\{\s*test\s*\}\s+from\s+"@playwright/test";', `
                'import { test, expect, type Page } from "@playwright/test";'
        }
        else {
            $content = 'import { test, expect, type Page } from "@playwright/test";' + "`r`n`r`n" + $content
        }
    }

    $content = $content -replace `
        'async function runVerification\(\s*page\s*,\s*url:\s*string\s*\)', `
        'async function runVerification(page: Page, url: string)'

    Set-Content -Path $testFile -Value $content -Encoding UTF8

    Write-Host "  Updated: tests\e2e\verification.spec.ts" -ForegroundColor Green
}
else {
    Write-Host "  Test file not found. Skipping." -ForegroundColor DarkYellow
}

# --------------------------------------------------
# 2. Update .gitignore
# --------------------------------------------------

Write-Host ""
Write-Host "[2/5] Checking .gitignore..." -ForegroundColor Yellow

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
# 3. TypeScript validation
# --------------------------------------------------

Write-Host ""
Write-Host "[3/5] Running TypeScript validation..." -ForegroundColor Yellow

npx tsc --noEmit

if ($LASTEXITCODE -eq 0) {
    Write-Host "  TypeScript validation passed." -ForegroundColor Green
}
else {
    Write-Host "  TypeScript validation failed." -ForegroundColor Red
}

# --------------------------------------------------
# 4. Lint
# --------------------------------------------------

Write-Host ""
Write-Host "[4/5] Running lint..." -ForegroundColor Yellow

npm run lint

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Lint completed successfully." -ForegroundColor Green
}
else {
    Write-Host "  Lint reported errors or warnings." -ForegroundColor DarkYellow
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

# --------------------------------------------------
# Final Git status
# --------------------------------------------------

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Final Git Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

git status --short

Write-Host ""
Write-Host "Verification completed." -ForegroundColor Cyan
