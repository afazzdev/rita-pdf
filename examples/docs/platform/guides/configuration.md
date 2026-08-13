# Configuration

Every setting is an environment variable. There is no config file, on purpose: a container should
be fully described by its environment.

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PORT` | no | `8080` | HTTP listen port |
| `LOG_LEVEL` | no | `info` | One of `debug`, `info`, `warn`, `error` |
| `BILLING_WEBHOOK_SECRET` | yes | — | Shared secret for inbound webhooks |

## Profiles

```bash
export DATABASE_URL="postgres://localhost/platform"
export LOG_LEVEL=debug
npm start
```

See [the API reference](../reference/api.md) for what the running service exposes.
