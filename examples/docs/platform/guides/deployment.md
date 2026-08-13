# Deployment

Images are built per commit and deployed by tag.

```bash
docker build -t platform:"$(git rev-parse --short HEAD)" .
docker push registry.example.com/platform
```

Rollback is a redeploy of the previous tag; there is no separate rollback path.
