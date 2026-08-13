# API Reference

All endpoints are JSON over HTTPS and require a bearer token unless marked public.

| Method | Path                      | Purpose                | Request body   | Response          | Auth          |
| ------ | ------------------------- | ---------------------- | -------------- | ----------------- | ------------- |
| GET    | `/v1/accounts`            | Paginated account list | —              | `Page<Account>`   | Authenticated |
| POST   | `/v1/accounts`            | Create an account      | `AccountDraft` | `Account`, 201    | Authenticated |
| GET    | `/v1/accounts/{id}`       | Fetch one account      | —              | `Account`         | Authenticated |
| POST   | `/v1/accounts/{id}/close` | Close an account       | `CloseRequest` | `204 No Content`  | Authenticated |
| GET    | `/v1/health`              | Liveness probe         | —              | `{"status":"ok"}` | Public        |

## Errors

Every error shares one envelope:

```json
{
  "error": "account_not_found",
  "message": "No account with that id",
  "traceId": "a1b2c3d4"
}
```
