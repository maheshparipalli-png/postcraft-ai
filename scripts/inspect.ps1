Write-Host "===============================" -ForegroundColor Cyan
Write-Host " PostCraft AI - Project Inspect" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

Write-Host "`nCurrent directory:" -ForegroundColor Yellow
Get-Location

Write-Host "`nGit status:" -ForegroundColor Yellow
git status --short

Write-Host "`nCurrent branch:" -ForegroundColor Yellow
git branch --show-current

Write-Host "`nLatest commits:" -ForegroundColor Yellow
git log --oneline -5

Write-Host "`nProject files:" -ForegroundColor Yellow
Get-ChildItem -Path . -File -Force |
    Where-Object {
        $_.Name -in @(
            "package.json",
            "package-lock.json",
            ".env.example",
            "next.config.js",
            "next.config.mjs",
            "next.config.ts",
            "tsconfig.json"
        )
    } |
    Select-Object Name, Length, LastWriteTime

Write-Host "`nBilling references:" -ForegroundColor Yellow
git grep -n -i "billing\|trial\|subscription" -- app lib components 2>$null

Write-Host "`nAI provider references:" -ForegroundColor Yellow
git grep -n -i "AI_PROVIDER\|OLLAMA\|GEMINI" -- app lib .env.example 2>$null

Write-Host "`nInspection completed." -ForegroundColor Green
