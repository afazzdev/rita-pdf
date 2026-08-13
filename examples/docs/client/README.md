# Client

The browser client that talks to the platform.

## Architecture

```mermaid
graph TD
    UI[Components] --> Hooks[Data hooks]
    Hooks --> Client[HTTP client]
    Client --> API[Platform API]
    Hooks --> Store[Session store]
    UI --> Store
```

Data fetching never happens in a component; it happens in a hook, so the component stays a pure
function of its props and the store.
