# Deploy

This site deploys to Surge from the Vite production build.

Public URL:

```text
https://hexagon-cover-visual.surge.sh
```

First-time setup:

```bash
surge login
```

Publish or update the site:

```bash
npm run deploy
```

The deploy script runs the production build, then publishes `dist/` to the fixed Surge domain.
