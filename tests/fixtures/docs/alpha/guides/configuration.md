# Configuration

## Narrow table

| Key    | Value  |
| ------ | ------ |
| `PORT` | `8080` |

## Six columns

| Method | Path         | Purpose        | Request body | Response      | Auth          |
| ------ | ------------ | -------------- | ------------ | ------------- | ------------- |
| GET    | `/v1/things` | List things    | —            | `Page<Thing>` | Authenticated |
| POST   | `/v1/things` | Create a thing | `ThingDraft` | `Thing`       | Authenticated |
