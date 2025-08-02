#!/bin/bash

# MCP Builder CLI NPM Publishing Script

set -e

echo "🚀 MCP Builder CLI Publishing Script"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're on the main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You're not on the main branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Check if npm is logged in
if ! npm whoami > /dev/null 2>&1; then
    print_error "You're not logged in to npm. Please run 'npm login' first."
    exit 1
fi

print_success "NPM login verified: $(npm whoami)"

# Run tests
print_status "🧪 Running tests..."
npm run test

if [ $? -ne 0 ]; then
    print_error "Tests failed. Publishing aborted."
    exit 1
fi

print_success "All tests passed!"

# Build the project
print_status "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed. Publishing aborted."
    exit 1
fi

print_success "Build completed!"

# Test CLI functionality
print_status "🧪 Testing CLI functionality..."
chmod +x dist/src/cli/cli-main.js
node dist/src/cli/cli-main.js --help > /dev/null

if [ $? -ne 0 ]; then
    print_error "CLI functionality test failed. Publishing aborted."
    exit 1
fi

print_success "CLI functionality verified!"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Ask for version bump
echo "Select version bump type:"
echo "1) patch (bug fixes)"
echo "2) minor (new features)"
echo "3) major (breaking changes)"
echo "4) skip version bump"
read -p "Enter choice (1-4): " -n 1 -r
echo

case $REPLY in
    1)
        npm version patch
        ;;
    2)
        npm version minor
        ;;
    3)
        npm version major
        ;;
    4)
        print_status "Skipping version bump"
        ;;
    *)
        print_error "Invalid choice. Aborted."
        exit 1
        ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
    print_success "Version bumped to: $NEW_VERSION"
    
    # Push version bump
    git push origin main --tags
fi

# Create package
print_status "📦 Creating package..."
npm pack

print_success "Package created: mcp-builder-$NEW_VERSION.tgz"

# Final confirmation
print_warning "About to publish mcp-builder@$NEW_VERSION to NPM"
read -p "Continue with publishing? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Publishing cancelled."
    exit 0
fi

# Publish to NPM
print_status "📤 Publishing to NPM..."
npm publish

if [ $? -eq 0 ]; then
    print_success "Successfully published mcp-builder@$NEW_VERSION to NPM!"
    
    echo ""
    echo "🎉 Publication complete!"
    echo "Users can now install with:"
    echo "  npm install -g mcp-builder"
    echo "  # or run directly:"
    echo "  npx mcp-builder"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update documentation if needed"
    echo "2. Create GitHub release"
    echo "3. Announce the release"
else
    print_error "Publishing failed!"
    exit 1
fi