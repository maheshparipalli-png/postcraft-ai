# zip-source.ps1
# Creates a clean ZIP archive containing project source files.

param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$ProjectPath = (Resolve-Path $ProjectPath).Path

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $projectName = Split-Path $ProjectPath -Leaf
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = Join-Path (Split-Path $ProjectPath -Parent) "$projectName-source-$timestamp.zip"
}
else {
    $OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
}

$tempRoot = Join-Path $env:TEMP ("source-zip-" + [guid]::NewGuid().ToString())
$tempProject = Join-Path $tempRoot (Split-Path $ProjectPath -Leaf)

New-Item -ItemType Directory -Path $tempProject -Force | Out-Null

# Directories to exclude
$excludedDirectories = @(
    "node_modules",
    ".next",
    "dist",
    "build",
    "out",
    "coverage",
    ".cache",
    ".turbo",
    ".vercel",
    ".git",
    ".idea",
    ".vscode",
    "tmp",
    "temp",
    "logs"
)

# Files to exclude
$excludedFileNames = @(
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
    "npm-debug.log",
    "yarn-debug.log",
    "yarn-error.log",
    "pnpm-debug.log"
)

$excludedExtensions = @(
    ".log",
    ".tmp",
    ".bak"
)

function Should-Exclude {
    param(
        [System.IO.FileInfo]$File
    )

    $relativePath = $File.FullName.Substring($ProjectPath.Length).TrimStart("\", "/")
    $pathParts = $relativePath -split "[\\/]" 

    foreach ($directory in $excludedDirectories) {
        if ($pathParts -contains $directory) {
            return $true
        }
    }

    if ($excludedFileNames -contains $File.Name) {
        return $true
    }

    if ($excludedExtensions -contains $File.Extension.ToLowerInvariant()) {
        return $true
    }

    return $false
}

$files = Get-ChildItem `
    -Path $ProjectPath `
    -File `
    -Recurse |
    Where-Object {
        -not (Should-Exclude $_)
    }

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($ProjectPath.Length).TrimStart("\", "/")
    $destination = Join-Path $tempProject $relativePath
    $destinationDirectory = Split-Path $destination -Parent

    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -Path $file.FullName -Destination $destination -Force
}

# Include a safe project manifest, if present
$readmePath = Join-Path $tempProject "SOURCE-ZIP-README.txt"

@"
This archive contains the project source files for code review.

Excluded:
- node_modules
- Build output
- Framework caches
- Git metadata
- Environment files and secrets
- Logs and temporary files

Before sharing this archive, check that no API keys, tokens, passwords,
private certificates, or other confidential information are included.
"@ | Set-Content -Path $readmePath -Encoding UTF8

if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

Compress-Archive `
    -Path (Join-Path $tempRoot "*") `
    -DestinationPath $OutputPath `
    -CompressionLevel Optimal

Remove-Item $tempRoot -Recurse -Force

Write-Host ""
Write-Host "Source ZIP created successfully:" -ForegroundColor Green
Write-Host $OutputPath
Write-Host ""