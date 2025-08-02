# MCP Builder CLI Deployment Script for Windows PowerShell

param(
    [switch]$Npm,
    [switch]$Test,
    [switch]$Help
)

if ($Help) {
    Write-Host "MCP Builder CLI Deployment Script" -ForegroundColor Cyan
    Write-Host "Usage: .\deploy.ps1 -Npm [-Test]" -ForegroundColor Yellow
    Write-Host "       .\deploy.ps1 -Help" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Npm    Build and prepare for NPM publishing" -ForegroundColor White
    Write-Host "  -Test   Run tests before deployment" -ForegroundColor White
    Write-Host "  -Help   Show this help message" -ForegroundColor White
    exit 0
}

if (-not $Npm) {
    Write-Host "Please specify -Npm to build for NPM publishing" -ForegroundColor Red
    Write-Host "Use -Help for more information" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 MCP Builder CLI NPM Deployment" -ForegroundColor Cyan

# Check npm
try {
    npm --version | Out-Null
    Write-Host "✅ NPM found" -ForegroundColor Green
} catch {
    Write-Host "❌ NPM not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

# Check Node.js version
try {
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js version 18 or higher is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js version compatible: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    exit 1
}

# Run tests if requested
if ($Test) {
    Write-Host "🧪 Running tests..." -ForegroundColor Blue
    npm run test
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests failed. Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ All tests passed" -ForegroundColor Green
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

# Test CLI functionality
Write-Host "🧪 Testing CLI functionality..." -ForegroundColor Blue
node dist/src/cli/cli-main.js --help | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CLI functionality test passed" -ForegroundColor Green
} else {
    Write-Host "❌ CLI functionality test failed" -ForegroundColor Red
    exit 1
}

# Package
Write-Host "📦 Creating package..." -ForegroundColor Blue
npm pack

Write-Host "✅ Package created: mcp-builder-1.0.0.tgz" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. npm login" -ForegroundColor White
Write-Host "2. npm publish" -ForegroundColor White
Write-Host "3. Users can install with: npm install -g mcp-builder" -ForegroundColor White
Write-Host "4. Or run directly with: npx mcp-builder" -ForegroundColor White