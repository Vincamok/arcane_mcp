# Contributing

Thanks for your interest! Issues and pull requests are welcome.

## Getting started

```bash
npm ci
npm run build      # compile TypeScript to dist/
npm run dev        # run from sources (needs ARCANE_URL and ARCANE_API_KEY)
```

Test against a non-production Arcane instance, preferably with `ARCANE_READ_ONLY=true`.

## Pull requests

- Keep changes focused and explain the motivation.
- Run `npm run build` before submitting; it must pass without errors.
- Never include real URLs of private instances, API keys, tokens or personal data in code, docs, tests, screenshots or commit messages. Use placeholders such as `https://arcane.example.com`.
- Security issues: do not open a public issue; see [SECURITY.md](SECURITY.md).

## Licensing of contributions

By submitting a contribution, you certify that you have the right to submit it and agree that it is licensed under the project's [MIT license](LICENSE), and that your contribution may be redistributed under it.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
