Write-Host "==============================" -ForegroundColor Cyan
Write-Host " PostCraft AI - Verification" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

Write-Host "`n1. Running ESLint..." -ForegroundColor Yellow
npm run lint

Write-Host "`n2. Running TypeScript check..." -ForegroundColor Yellow
npx tsc --noEmit

Write-Host "`n3. Running production build..." -ForegroundColor Yellow
npm run build

Write-Host "`nVerification completed." -ForegroundColor Green
