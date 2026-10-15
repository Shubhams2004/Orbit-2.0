# Orbit 2.0 Cloudflare Workers & D1 Deployment Guide

This guide details how Orbit 2.0 is deployed as a unified Cloudflare Worker serving the React frontend (via Workers Static Assets), the REST API (`/api/v1/*`), and Cloudflare D1 persistent storage.

---

## 1. Architecture Overview

- **Unified Worker**: A single Cloudflare Worker (`worker/index.ts`) handles API requests, background operations, and asset delivery.
- **Frontend SPA**: Vite compiles the React + TypeScript frontend into `./dist`. Cloudflare Workers Static Assets (`assets` in `wrangler.jsonc`) serves static files directly with edge caching and provides Single-Page Application (SPA) routing fallback for all client routes (`/`, `/tasks`, `/projects`, `/chat`).
- **REST API**: All requests starting with `/api/` are routed to Worker endpoints. Unknown `/api/*` endpoints always return structured JSON 404/405 errors (never HTML pages). Production exceptions are sanitized to avoid leaking database internals, secrets, or stack traces.
- **Database**: Cloudflare D1 (serverless SQLite at the edge) stores users, tasks, projects, conversations, messages, and agent runs. Migrations in `./migrations` define the versioned schema.
- **Local Dev vs. Production**: Local development runs via `npm run dev` with isolated local SQLite storage and Vite dev middleware. It never accesses or mutates production D1 data.

---

## 2. Prerequisites & Environment Requirements

| Requirement | Value / Recommendation | Notes |
|---|---|---|
| **Node.js** | `>= 20.0.0` (LTS 20 or 22 recommended) | Required for Vite and Wrangler |
| **Package Manager** | `npm` | Standardized on `package-lock.json` (`npm ci` on Cloudflare Builds) |
| **Cloudflare Account** | Free or Paid Workers plan | Includes Cloudflare D1 and Workers Static Assets |
| **Wrangler CLI** | `^4.151.0` (installed locally in `devDependencies`) | Run via `npx wrangler` or npm scripts |

---

## 3. Completed vs. Remaining Manual Setup

### ✅ Completed in this Repository
1. `wrangler.jsonc` configured with:
   - Worker entry point (`worker/index.ts`)
   - Assets directory (`./dist`) with `not_found_handling: "single-page-application"` and `run_worker_first: true`
   - D1 database bindings for production (`orbit_d1_db`) and staging (`orbit_d1_db_staging`)
   - Environment variables (`ENVIRONMENT`, `API_VERSION`)
2. `vite.config.ts` configured with `build.outDir: "dist"`
3. `package.json` configured with build, deploy, database migration, and validation scripts
4. Versioned SQL migrations (`migrations/0001_initial_schema.sql`, `migrations/0002_seed_demo_data.sql`)
5. Isolated local development server (`server.ts`) connecting local SQLite and Vite middlewares
6. Deployment readiness validation script (`npm run validate:deploy`)

### 📋 Remaining Manual Steps (One-Time Setup)
1. Authenticate Wrangler with your Cloudflare account (`npx wrangler login`).
2. Create the production D1 database in Cloudflare (`npm run db:create`).
3. Paste the generated D1 database ID into `wrangler.jsonc` replacing `<YOUR_D1_DATABASE_ID>`.
4. Apply migrations to the remote database (`npm run db:migrate:remote`).
5. Connect your GitHub repository to Cloudflare Workers Builds (or run `npm run deploy`).

---

## 4. Step-by-Step Initial Deployment

### Step 1: Validate Local Project Build
Ensure that tests pass and the frontend builds cleanly:
```bash
# 1. Typecheck and run backend integration suite
npm run validate

# 2. Build frontend production bundle
npm run build

# 3. Check deployment configuration readiness
npm run validate:deploy
```

### Step 2: Log In to Cloudflare
```bash
npx wrangler login
```

### Step 3: Create the Production Cloudflare D1 Database
Create the production database:
```bash
npm run db:create
# Equivalent to: npx wrangler d1 create orbit_d1_db
```
Wrangler will output:
```text
✅ Successfully created DB 'orbit_d1_db'!
[[d1_databases]]
binding = "DB"
database_name = "orbit_d1_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 4: Update `wrangler.jsonc`
Open `wrangler.jsonc` and replace the placeholder `<YOUR_D1_DATABASE_ID>` with the actual database UUID from Step 3:
```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "orbit_d1_db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "migrations_dir": "migrations"
    }
  ],
```

### Step 5: Apply Migrations to Remote D1 Database
Apply schema migrations safely to your production database:
```bash
npm run db:migrate:remote
# Equivalent to: npx wrangler d1 migrations apply orbit_d1_db --remote
```
Wrangler will display the migrations to be applied (`0001_initial_schema.sql`, `0002_seed_demo_data.sql`) and prompt for confirmation before executing.

To inspect applied migrations at any time:
```bash
npm run db:list:remote
```

### Step 6: Deploy the Unified Worker
Deploy the static assets and backend API to Cloudflare Workers:
```bash
npm run deploy
# Equivalent to: npx wrangler deploy
```
Wrangler will upload `./dist` static assets, bundle `worker/index.ts`, bind the `DB` database and `ASSETS`, and provide your live application URL:
```text
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded orbit-app (x.xx sec)
Deployed orbit-app triggers:
  https://orbit-app.<your-subdomain>.workers.dev
```

---

## 5. Automated CI/CD with Cloudflare Workers Builds (GitHub Integration)

Cloudflare Workers natively supports **Workers Builds** connected directly to your GitHub repository:

### Cloudflare Dashboard Configuration
1. Go to the **Cloudflare Dashboard** → **Compute (Workers & Pages)**.
2. Click **Create** → **Workers** → **Connect to Git**.
3. Select your GitHub repository (`orbit-2.0`).
4. Configure the build settings:
   - **Framework Preset**: `None` / `Vite`
   - **Build Command**: `npm run build`
   - **Deploy Command**: `npx wrangler deploy`
   - **Node.js Version**: `20` or `22` (or set environment variable `NODE_VERSION: 20`)
   - **Root Directory**: `/` (repository root)
5. Under **Settings → Bindings**:
   - Ensure the D1 Database binding `DB` is linked to `orbit_d1_db`.
6. Save and deploy.

### Automatic Push Workflow
- Every `git push` to `main` automatically triggers Cloudflare Workers Builds.
- Cloudflare pulls the commit, runs `npm run build` (compiling the React app into `./dist`), and deploys the unified Worker.
- Staging previews can be configured for pull requests using the `--env staging` configuration in `wrangler.jsonc`.

---

## 6. Database Safety & Migration Governance

- **Explicit Migration Execution**: Production migrations are **never** executed automatically during runtime or asset compilation. Migrations must be verified and executed explicitly via `npm run db:migrate:remote`.
- **Reproducible Versioning**: Each migration in `/migrations` follows strict sequential numbering (`0001_*.sql`, `0002_*.sql`).
- **Data Isolation**: Local development uses an isolated SQLite file (`.dev-d1.sqlite`) with automated local seeding. Remote operations require explicit `--remote` flags and Cloudflare authorization tokens.

---

## 7. Verification & Health Monitoring

Once deployed, verify your service endpoints:

```bash
# 1. Health check endpoint (returns JSON status, version, and DB binding state)
curl https://orbit-app.<your-subdomain>.workers.dev/api/v1/health

# 2. Frontend route (returns SPA index.html)
curl -I https://orbit-app.<your-subdomain>.workers.dev/tasks

# 3. Unknown API route (returns JSON 404, NOT html)
curl https://orbit-app.<your-subdomain>.workers.dev/api/v1/unknown
```
