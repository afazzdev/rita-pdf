# Platform

The example service this handbook documents. Everything here is fictional — it exists so
`rita-pdf` has something to bind, and so CI can prove the output still works.

## Table of Contents

- [Layout](#layout)
- [Where things live](#where-things-live)

## Layout

```
.
├── api/                    # HTTP handlers
│   ├── routes.ts           # Route table
│   └── middleware.ts       # Auth, logging, rate limits
├── core/                   # Domain logic, no I/O
│   ├── billing.ts          # Invoices and proration
│   └── accounts.ts         # Account lifecycle
└── store/                  # Persistence
    ├── migrations/         # Ordered, never edited once shipped
    └── queries.ts          # Hand-written SQL
```

## Where things live

Configuration is described in `platform/guides/configuration.md`, and the endpoint table is in
`platform/reference/api.md`.
