# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0]

### Added
- MCP server for Arcane generated at startup from the instance's OpenAPI spec.
- Generic tools `arcane_search_operations`, `arcane_describe_operation`, `arcane_call`, plus per-operation tools selectable with `ARCANE_TOOLSETS`.
- stdio (CLI) and streamable HTTP transports, Docker image and `docker-compose.yml`.
- Read-only mode, default environment ID, optional bearer protection of the HTTP endpoint.
- Support for Arcane v3 `/agents/{id}` routes.
- License (MIT), security policy, privacy notice, code of conduct, contributing guide.
