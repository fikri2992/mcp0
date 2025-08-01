# MCP API Server Deployment Script for Windows PowerShell

param(
    [switch]$Npm,
    [switch]$Help
)

if ($Help) {
    Write-Host "MCP API Server Deployment Script" -ForegroundColor Cyan
    Write-Host "Usage: .\deploy.ps1 -Npm" -ForegroundColor Yellow
    Write-Host "       .\deploy.ps1 -Help" -ForegroundColor Yellow
    exit 0
}

if (-not $Npm) {
    Write-Host "Please specify -Npm to build for NPM publishing" -ForegroundColor Red
    Write-Host "Use -Help for more information" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 MCP API Server NPM Deployment" -ForegroundColor Cyan

# Check npm
try {
    npm --version | Out-Null
    Write-Host "✅ NPM found" -ForegroundColor Green
} catch {
    Write-Host "❌ NPM not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

# Build
Write-Host "🔨 Building..." -ForegroundColor Blue
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Package
Write-Host "📦 Creating package..." -ForegroundColor Blue
npm pack

Write-Host "✅ Package created: mcp-api-server-1.0.0.tgz" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. npm login" -ForegroundColor White
Write-Host "2. npm publish" -ForegroundColor White
Write-Host "3. Users can run: npx mcp-api-server" -ForegroundColor White