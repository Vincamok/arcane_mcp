# arcane-mcp

Serveur [MCP](https://modelcontextprotocol.io) pour une instance [Arcane](https://github.com/getarcaneapp/arcane) (gestion Docker). Les outils sont **générés au démarrage** depuis `<ARCANE_URL>/api/openapi.json` (doc : `/api/docs`), donc ils suivent la version d'Arcane de votre instance.

## Configuration

| Variable (flag) | Rôle | Défaut |
|---|---|---|
| `ARCANE_URL` (`--url`) | URL de l'instance (sans `/api`) | requis |
| `ARCANE_API_KEY` (`--api-key`) | Clé API (header `X-API-Key`) — créez-la dans Arcane › API Keys | requis* |
| `ARCANE_TOKEN` | Alternative : JWT Bearer | |
| `ARCANE_READ_ONLY` | `true` = seules les requêtes GET sont possibles | `false` |
| `ARCANE_TOOLSETS` | `default`, `all`, `none` ou liste de tags (`containers,projects,swarm`) exposés en un outil par opération | `default` |
| `ARCANE_ENVIRONMENT_ID` | Environnement par défaut (`id` des routes `/environments/{id}/…`) | |
| `ARCANE_INSECURE_TLS` | Ignorer la validation TLS (auto-signé) | `false` |
| `MCP_TRANSPORT` | `stdio` ou `http` | `stdio` |
| `MCP_PORT` / `MCP_HOST` | Écoute HTTP | `3000` / `0.0.0.0` |
| `MCP_AUTH_TOKEN` | Bearer exigé sur `/mcp` (HTTP) | |

Outils toujours présents, couvrant **toute** l'API : `arcane_search_operations`, `arcane_describe_operation`, `arcane_call`. Par-dessus, un outil par opération pour les tags choisis (défaut : Containers, Images, Projects, Networks, Volumes, Environments, System, Dashboard, Image Updates, Events).

## Mode CLI (stdio)

```bash
npm ci && npm run build
ARCANE_URL=https://dock.vincz.fr ARCANE_API_KEY=... node dist/index.js
```

Claude Desktop / Claude Code (`.mcp.json`) :

```json
{
  "mcpServers": {
    "arcane": {
      "command": "node",
      "args": ["/chemin/vers/arcane_mcp/dist/index.js"],
      "env": { "ARCANE_URL": "https://dock.vincz.fr", "ARCANE_API_KEY": "...", "ARCANE_ENVIRONMENT_ID": "0" }
    }
  }
}
```

## Docker (HTTP streamable)

```bash
cp .env.example .env   # renseigner ARCANE_API_KEY et MCP_AUTH_TOKEN
docker compose up -d --build
```

Endpoint : `http://<hôte>:3000/mcp` (header `Authorization: Bearer <MCP_AUTH_TOKEN>`), santé : `/health`.
Client : `claude mcp add --transport http arcane http://<hôte>:3000/mcp --header "Authorization: Bearer <token>"`.

Ou en stdio via Docker : `docker run -i --rm -e MCP_TRANSPORT=stdio -e ARCANE_URL=... -e ARCANE_API_KEY=... arcane-mcp`.

## Sécurité

Ce serveur pilote votre hôte Docker : utilisez `ARCANE_READ_ONLY=true` pour de la simple supervision, protégez toujours l'endpoint HTTP (`MCP_AUTH_TOKEN` + reverse proxy TLS), et utilisez une clé API dédiée.
Les opérations de streaming / upload / téléchargement binaire ne sont pas exposées.
