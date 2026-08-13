# State

One store, three slices, no exceptions.

| Slice | Holds | Persisted |
|---|---|---|
| `session` | Token, current user, permissions | Yes |
| `ui` | Sidebar state, active modal | No |
| `cache` | Server responses, keyed by request | No |

Configuration for the client lives alongside the platform's, in
`platform/guides/configuration.md`.
