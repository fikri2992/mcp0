#!/bin/bash

# MCP Builder CLI Deployment Script

set -e

echo "🚀 MCP Builder CLI Deployment Script"
echo "=================================="

# Function to print colored output
print_status() {
    echo -e "\033[1;34m$1\033[0m"
}

print_success() {
    echo -e "\033[1;32m✅ $1\033[0m"
}

print_error() {
    echo -e "\033[1;31m❌ $1\033[0m"
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if Node.js version is compatible
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

# Parse command line arguments
DEPLOY_TYPE=""
PUBLISH_NPM=false
BUILD_DOCKER=false
PUSH_DOCKER=false
DOCKER_REGISTRY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --npm)
            DEPLOY_TYPE="npm"
            PUBLISH_NPM=true
            shift
            ;;
        --docker)
            DEPLOY_TYPE="docker"
            BUILD_DOCKER=true
            shift
            ;;
        --docker-push)
            DEPLOY_TYPE="docker"
            BUILD_DOCKER=true
            PUSH_DOCKER=true
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --all)
            PUBLISH_NPM=true
            BUILD_DOCKER=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --npm                 Build and prepare for NPM publishing"
            echo "  --docker              Build Docker image"
            echo "  --docker-push REGISTRY Build and push Docker image to registry"
            echo "  --all                 Build for both NPM and Docker"
            echo "  --help, -h            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --npm"
            echo "  $0 --docker"
            echo "  $0 --docker-push yourusername"
            echo "  $0 --all"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

if [[ -z "$DEPLOY_TYPE" && "$PUBLISH_NPM" == false && "$BUILD_DOCKER" == false ]]; then
    print_error "Please specify deployment type. Use --help for options."
    exit 1
fi

# Run tests before deployment
print_status "🧪 Running tests..."
npm run test

if [ $? -ne 0 ]; then
    print_error "Tests failed. Deployment aborted."
    exit 1
fi

print_success "All tests passed!"

# Clean and build
print_status "🧹 Cleaning previous build..."
npm run clean

print_status "🔨 Building TypeScript..."
npm run build

# Make CLI executable
chmod +x dist/src/cli/cli-main.js

print_success "Build completed successfully!"

# NPM Deployment
if [[ "$PUBLISH_NPM" == true ]]; then
    print_status "📦 Preparing NPM package..."
    
    # Test CLI functionality
    print_status "🧪 Testing CLI functionality..."
    node dist/src/cli/cli-main.js --help > /dev/null
    
    if [ $? -eq 0 ]; then
        print_success "CLI functionality test passed!"
    else
        print_error "CLI functionality test failed!"
        exit 1
    fi
    
    # Create package
    npm pack
    
    print_success "NPM package created: mcp-builder-1.0.0.tgz"
    
    echo ""
    echo "📋 Next steps for NPM publishing:"
    echo "1. Test the package locally:"
    echo "   npm install -g ./mcp-builder-1.0.0.tgz"
    echo "   mcp-builder --help"
    echo "   mcp-builder generate --help"
    echo ""
    echo "2. Login to NPM:"
    echo "   npm login"
    echo ""
    echo "3. Publish the package:"
    echo "   npm publish"
    echo ""
    echo "4. Users can then install with:"
    echo "   npm install -g mcp-builder"
    echo "   # or run directly with:"
    echo "   npx mcp-builder"
    echo ""
fi

# Docker Deployment
if [[ "$BUILD_DOCKER" == true ]]; then
    print_status "🐳 Building Docker image..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not running."
        exit 1
    fi
    
    # Build Docker image
    docker build -t mcp-builder:latest .
    
    # Tag with version
    docker tag mcp-builder:latest mcp-builder:1.0.0
    
    print_success "Docker image built: mcp-builder:latest"
    
    # Push to registry if requested
    if [[ "$PUSH_DOCKER" == true && -n "$DOCKER_REGISTRY" ]]; then
        print_status "📤 Pushing to Docker registry..."
        
        # Tag for registry
        docker tag mcp-builder:latest "$DOCKER_REGISTRY/mcp-builder:latest"
        docker tag mcp-builder:latest "$DOCKER_REGISTRY/mcp-builder:1.0.0"
        
        # Push images
        docker push "$DOCKER_REGISTRY/mcp-builder:latest"
        docker push "$DOCKER_REGISTRY/mcp-builder:1.0.0"
        
        print_success "Images pushed to $DOCKER_REGISTRY"
        
        echo ""
        echo "📋 Users can now run:"
        echo "   docker run --rm $DOCKER_REGISTRY/mcp-builder:latest --help"
        echo "   docker run -v \$(pwd):/workspace $DOCKER_REGISTRY/mcp-builder:latest generate /workspace/api.md -o /workspace/output"
    else
        echo ""
        echo "📋 Next steps for Docker deployment:"
        echo "1. Test the image:"
        echo "   docker run --rm mcp-builder:latest --help"
        echo ""
        echo "2. Run the CLI with mounted workspace:"
        echo "   docker run --rm -v \$(pwd):/workspace mcp-builder:latest generate /workspace/api.md -o /workspace/output"
        echo ""
        echo "3. Or use docker-compose for development:"
        echo "   docker-compose up -d"
        echo ""
        if [[ "$PUSH_DOCKER" == false ]]; then
            echo "4. To push to a registry:"
            echo "   docker tag mcp-builder:latest yourusername/mcp-builder:latest"
            echo "   docker push yourusername/mcp-builder:latest"
            echo ""
        fi
    fi
fi

print_success "Deployment preparation completed!"

echo ""
echo "📚 For detailed deployment instructions, see:"
echo "   - README.md (for usage)"
echo "   - DEPLOYMENT.md (for deployment guides)"