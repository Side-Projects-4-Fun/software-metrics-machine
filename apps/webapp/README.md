# @smmachine/webapp

Next.js dashboard for Software Metrics Machine. Displays change request, pipeline, and code metrics served by the REST API.

## Data mutability boundary

The webapp is strictly read-only.

- It must only visualize data exposed by the REST API.
- It must not generate analysis artifacts, write files, or persist snapshots.
- Data generation and persistence are CLI responsibilities.

## Features

- **Change request metrics**: review times, author contributions, throughput trends
- **Pipeline metrics**: CI/CD runs, job status, deployment frequency
- **Source code metrics**: pairing index, code churn, coupling, entity effort

## Development

### 1. Install dependencies

```bash
# From the repo root
pnpm install
```

### 2. Configure environment

Create `.env.local` in this directory:

```bash
SMM_REST_BASE_URL=http://localhost:8000
```

> **Note**: `SMM_REST_BASE_URL` is a server-side runtime variable — it is read when the process starts, not inlined at build time. You can change it by setting the env var before starting the server; no rebuild required.

### 3. Start the REST API

The webapp requires the REST API to be running. From the repo root:

```bash
SMM_STORE_DATA_AT=./.data pnpm --filter @smmachine/rest dev
```

### 4. Run the dev server

```bash
SMM_REST_BASE_URL=http://localhost:8000 pnpm --filter @smmachine/webapp dev -- -H 0.0.0.0
```

Open http://localhost:3000.

## Production

In production the webapp is served via the CLI:

```bash
smm dashboard serve   # webapp on :3000, REST API on :3001
```

This requires a full build from the repo root first:

```bash
SMM_REST_BASE_URL=http://localhost:3001 pnpm run build:npm
```

The webapp uses `output: standalone` — use `smm dashboard serve` or `node .next/standalone/server.js` to serve it. `next start` is not compatible with standalone output.
