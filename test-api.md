# Test API

This is a test API specification for testing the MCP Builder CLI.

## Get User

Retrieve user information by ID.

```bash
curl -X GET "https://api.example.com/users/123" \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json"
```

## Create User

Create a new user.

```bash
curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30
  }'
```

## Update User

Update an existing user.

```bash
curl -X PUT "https://api.example.com/users/123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "name": "John Smith",
    "email": "johnsmith@example.com"
  }'
```