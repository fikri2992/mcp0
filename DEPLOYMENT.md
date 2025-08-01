# Deployment Guide

This guide covers how to deploy the MCP API Server using different methods.

## NPM/NPX Deployment

### Publishing to NPM

1. **Prepare for publishing:**
   ```bash
   # Build the project
   npm run build
   
   # Test the package locally
   npm pack
   npm install -g ./mcp-api-server-1.0.0.tgz
   mcp-api-server --help
   ```

2. **Login to NPM:**
   ```bash
   npm login
   ```

3. **Publish the package:**
   ```bash
   # For first-time publishing
   npm publish
   
   # For updates (increment version first)
   npm version patch  # or minor/major
   npm publish
   ```

4. **Verify publication:**
   ```bash
   npx mcp-api-server --help
   ```

### Using the Published Package

Once published, users can run it with:

```bash
# Run directly with npx
npx mcp-api-server

# Or install globally
npm install -g mcp-api-server
mcp-api-server
```

### MCP Client Configuration

Add to MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server"],
      "env": {
        "DEBUG": "false",
        "ALLOW_LOCALHOST": "false"
      }
    }
  }
}
```

## Docker Deployment

### Building the Docker Image

1. **Build the image:**
   ```bash
   docker build -t mcp-api-server:latest .
   ```

2. **Test the image:**
   ```bash
   docker run --rm mcp-api-server:latest --help
   ```

### Running with Docker

#### Basic Usage

```bash
# Run the container
docker run -d \
  --name mcp-api-server \
  --restart unless-stopped \
  mcp-api-server:latest
```

#### With Custom Configuration

```bash
# Run with environment variables
docker run -d \
  --name mcp-api-server \
  --restart unless-stopped \
  -e DEBUG=true \
  -e API_TIMEOUT=60000 \
  -e ALLOW_LOCALHOST=true \
  mcp-api-server:latest
```

#### Using Docker Compose

1. **Production deployment:**
   ```bash
   docker-compose up -d
   ```

2. **Development deployment:**
   ```bash
   docker-compose --profile dev up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f mcp-api-server
   ```

4. **Stop services:**
   ```bash
   docker-compose down
   ```

### Docker Hub Deployment

1. **Tag the image:**
   ```bash
   docker tag mcp-api-server:latest yourusername/mcp-api-server:latest
   docker tag mcp-api-server:latest yourusername/mcp-api-server:1.0.0
   ```

2. **Push to Docker Hub:**
   ```bash
   docker login
   docker push yourusername/mcp-api-server:latest
   docker push yourusername/mcp-api-server:1.0.0
   ```

3. **Users can then run:**
   ```bash
   docker run -d yourusername/mcp-api-server:latest
   ```

### Using with MCP Clients

For Docker-based MCP server, you'll need to configure the MCP client to communicate with the container. Since MCP uses stdio transport, you would typically run:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "yourusername/mcp-api-server:latest"
      ],
      "env": {
        "DEBUG": "false"
      }
    }
  }
}
```

## Kubernetes Deployment

### Basic Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-api-server
  labels:
    app: mcp-api-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-api-server
  template:
    metadata:
      labels:
        app: mcp-api-server
    spec:
      containers:
      - name: mcp-api-server
        image: yourusername/mcp-api-server:latest
        env:
        - name: DEBUG
          value: "false"
        - name: API_TIMEOUT
          value: "30000"
        resources:
          limits:
            cpu: 500m
            memory: 256Mi
          requests:
            cpu: 100m
            memory: 64Mi
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-api-server-config
data:
  DEBUG: "false"
  API_TIMEOUT: "30000"
  ALLOW_LOCALHOST: "false"
  ALLOW_PRIVATE_IPS: "false"
```

Deploy with:
```bash
kubectl apply -f k8s-deployment.yaml
```

## Environment-Specific Configurations

### Development
```bash
# NPX
DEBUG=true ALLOW_LOCALHOST=true npx mcp-api-server

# Docker
docker run -e DEBUG=true -e ALLOW_LOCALHOST=true mcp-api-server:latest
```

### Staging
```bash
# NPX
API_TIMEOUT=45000 npx mcp-api-server

# Docker
docker run -e API_TIMEOUT=45000 mcp-api-server:latest
```

### Production
```bash
# NPX
USER_AGENT="Production-MCP-Server/1.0.0" npx mcp-api-server

# Docker
docker run -e USER_AGENT="Production-MCP-Server/1.0.0" mcp-api-server:latest
```

## Monitoring and Logging

### Docker Logs
```bash
# View logs
docker logs mcp-api-server

# Follow logs
docker logs -f mcp-api-server

# With timestamps
docker logs -t mcp-api-server
```

### Health Checks
The Docker image includes health checks. Monitor with:
```bash
docker inspect --format='{{.State.Health.Status}}' mcp-api-server
```

## Security Considerations

1. **Run as non-root user** (implemented in Docker image)
2. **Use read-only filesystem** (configured in docker-compose.yml)
3. **Limit resources** (CPU/memory limits in place)
4. **Network security** (disable localhost/private IPs in production)
5. **Regular updates** (keep dependencies updated)

## Troubleshooting

### Common Issues

1. **Permission denied:**
   ```bash
   # Ensure proper file permissions
   chmod +x dist/index.js
   ```

2. **Module not found:**
   ```bash
   # Rebuild the project
   npm run clean && npm run build
   ```

3. **Docker build fails:**
   ```bash
   # Clear Docker cache
   docker system prune -a
   docker build --no-cache -t mcp-api-server:latest .
   ```

4. **Container exits immediately:**
   ```bash
   # Check logs
   docker logs mcp-api-server
   
   # Run interactively
   docker run -it --rm mcp-api-server:latest sh
   ```