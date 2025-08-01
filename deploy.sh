#!/bin/bash

# MCP API Server Deployment Script

set -e

echo "🚀 MCP API Server Deployment Script"
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

# Clean and build
print_status "🧹 Cleaning previous build..."
npm run clean

print_status "🔨 Building TypeScript..."
npm run build

print_success "Build completed successfully!"

# NPM Deployment
if [[ "$PUBLISH_NPM" == true ]]; then
    print_status "📦 Preparing NPM package..."
    
    # Create package
    npm pack
    
    print_success "NPM package created: mcp-api-server-1.0.0.tgz"
    
    echo ""
    echo "📋 Next steps for NPM publishing:"
    echo "1. Test the package locally:"
    echo "   npm install -g ./mcp-api-server-1.0.0.tgz"
    echo "   mcp-api-server --help"
    echo ""
    echo "2. Login to NPM:"
    echo "   npm login"
    echo ""
    echo "3. Publish the package:"
    echo "   npm publish"
    echo ""
    echo "4. Users can then install with:"
    echo "   npx mcp-api-server"
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
    docker build -t mcp-api-server:latest .
    
    # Tag with version
    docker tag mcp-api-server:latest mcp-api-server:1.0.0
    
    print_success "Docker image built: mcp-api-server:latest"
    
    # Push to registry if requested
    if [[ "$PUSH_DOCKER" == true && -n "$DOCKER_REGISTRY" ]]; then
        print_status "📤 Pushing to Docker registry..."
        
        # Tag for registry
        docker tag mcp-api-server:latest "$DOCKER_REGISTRY/mcp-api-server:latest"
        docker tag mcp-api-server:latest "$DOCKER_REGISTRY/mcp-api-server:1.0.0"
        
        # Push images
        docker push "$DOCKER_REGISTRY/mcp-api-server:latest"
        docker push "$DOCKER_REGISTRY/mcp-api-server:1.0.0"
        
        print_success "Images pushed to $DOCKER_REGISTRY"
        
        echo ""
        echo "📋 Users can now run:"
        echo "   docker run -d $DOCKER_REGISTRY/mcp-api-server:latest"
    else
        echo ""
        echo "📋 Next steps for Docker deployment:"
        echo "1. Test the image:"
        echo "   docker run --rm mcp-api-server:latest --help"
        echo ""
        echo "2. Run the container:"
        echo "   docker run -d --name mcp-api-server mcp-api-server:latest"
        echo ""
        echo "3. Or use docker-compose:"
        echo "   docker-compose up -d"
        echo ""
        if [[ "$PUSH_DOCKER" == false ]]; then
            echo "4. To push to a registry:"
            echo "   docker tag mcp-api-server:latest yourusername/mcp-api-server:latest"
            echo "   docker push yourusername/mcp-api-server:latest"
            echo ""
        fi
    fi
fi

print_success "Deployment preparation completed!"

echo ""
echo "📚 For detailed deployment instructions, see:"
echo "   - README.md (for usage)"
echo "   - DEPLOYMENT.md (for deployment guides)"