# Privacy

`arcane-mcp` is self-hosted software. The maintainers do **not** operate any service, do **not** collect data and do **not** receive telemetry, analytics or crash reports from your installation.

## What the software does with data

- It forwards the requests made by your MCP client to the Arcane instance **you configure** (`ARCANE_URL`), authenticating with the API key or token **you provide**. Responses (which may contain container names, environment variables, logs, etc.) are returned to your MCP client, and therefore to the AI assistant and provider that client uses.
- It stores nothing on disk. Configuration is read from environment variables or command-line flags.
- It writes operational messages (startup information, errors) to standard error. Credentials are never logged.

## Your responsibilities

- Data returned by Arcane may be sent to a third-party AI provider through your MCP client. Make sure this is compatible with your own privacy obligations (for example GDPR) and with the confidentiality of what runs on your hosts.
- Protect your API key and `MCP_AUTH_TOKEN`; use `ARCANE_READ_ONLY=true` and the `ARCANE_TOOLSETS` setting to limit what the assistant can see or do.
