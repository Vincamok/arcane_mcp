# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.
Use GitHub's private reporting: **Security › Report a vulnerability** on this repository.

Include the affected version, steps to reproduce and the potential impact.
Reports are handled on a best-effort basis; there is no guaranteed response time.

## Scope and deployment notes

This server can drive a Docker host through the Arcane API. When deploying it:

- Use a dedicated Arcane API key with the least privileges needed, and set `ARCANE_READ_ONLY=true` when write access is not required.
- Always set `MCP_AUTH_TOKEN` in HTTP mode and put the endpoint behind TLS (reverse proxy). Never expose it publicly without authentication.
- Never commit API keys, tokens or `.env` files.
- `ARCANE_INSECURE_TLS=true` disables certificate validation; use it only on trusted networks.
