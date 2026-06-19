# Factur-X backend tests

The tests in this directory use Node's built-in `node:test` runner. They intentionally exercise the service modules directly and the Fastify bill route registration with lightweight fakes so they can run without MongoDB or Redis.

Run with:

```bash
npm --workspace backend test
```
