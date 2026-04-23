# Fashion Marketplace System

Full-stack marketplace system for fashion products with 3 core roles: **Customer**, **Vendor**, and **Admin**.

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Data Seeding and GAP Import](#data-seeding-and-gap-import)
- [Crawl GAP Dataset](#crawl-gap-dataset)
- [Quality Gates](#quality-gates)
- [Main API Areas](#main-api-areas)
- [Troubleshooting](#troubleshooting)

## Overview
- Customer flows: browse/search products, product detail, cart, checkout, order tracking, review.
- Vendor flows: product management, order handling, review replies, promotions, wallet/payout.
- Admin flows: user/store moderation, product governance, categories, orders/returns, vouchers, dashboard.
- Built-in seed + GAP CSV import pipeline to preload marketplace data.

## Tech Stack
- Backend: **Spring Boot 3.2.4**, Java 21, Spring Security, Spring Data JPA, WebSocket, PostgreSQL.
- Frontend: **React 19 + TypeScript + Vite**, Tailwind, Recharts, Framer Motion.
- Testing/QA: ESLint, UTF-8 checker, Playwright smoke regression.
- CI: GitHub Actions workflow at `.github/workflows/frontend-quality-gate.yml`.

## Repository Structure
```text
.
├─ backend/                  # Spring Boot API
│  ├─ src/main/java/...
│  └─ src/main/resources/...
├─ frontend/                 # React + Vite app
│  ├─ src/
│  └─ scripts/
├─ crawl/gap/                # GAP crawler script + config
├─ .github/workflows/        # CI workflows
└─ README.md
```

## Quick Start

### 1) Prerequisites
- Java **21**
- Node.js **20+**
- PostgreSQL **16+**
- npm

### 2) Clone and install
```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm ci
npm ci --prefix frontend
```

### 3) Create database
Create a PostgreSQL database:
- DB name: `fashion-store`
- User/password: configure to match your `.env` values

### 4) Configure environment

Backend reads config from:
- `backend/.env` (already supported by `application.yml` import)
- `backend/.env.example` (template, safe to commit)

Frontend reads config from:
- `frontend/.env`
- `frontend/.env.example` (template, safe to commit)

Minimum local variables:

Backend (`backend/.env`):
```env
DB_URL=jdbc:postgresql://localhost:5432/fashion-store
DB_USERNAME=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_long_random_secret

APP_SEED_ENABLED=true
APP_SEED_GAP_ENABLED=true
APP_SEED_GAP_TARGET_COUNT=1000
APP_SEED_GAP_STYLES_PATH=backend/src/main/resources/seeder/gap/styles.csv
APP_SEED_GAP_IMAGES_PATH=backend/src/main/resources/seeder/gap/images.csv
APP_SEED_GAP_CLEAN_BEFORE_IMPORT=true
```

If Azure Bot auth is disabled but your bot config class enforces non-blank values, set dummy values:
```env
AZURE_BOT_AUTH_ENABLED=false
MicrosoftAppId=00000000-0000-0000-0000-000000000000
MicrosoftAppPassword=dummy-secret
MicrosoftAppTenantId=00000000-0000-0000-0000-000000000000
```

Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:8080
```

### 5) Run backend
Windows:
```powershell
backend\mvnw.cmd -f backend/pom.xml spring-boot:run
```

macOS/Linux:
```bash
chmod +x backend/mvnw
./backend/mvnw -f backend/pom.xml spring-boot:run
```

### 6) Run frontend
```bash
npm run dev --prefix frontend
```

App URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Health: `http://localhost:8080/actuator/health`

## Configuration

Important backend flags (from `application.yml`):

| Variable | Description | Default |
|---|---|---|
| `APP_SEED_ENABLED` | Enable base seeding | `true` |
| `APP_SEED_GAP_ENABLED` | Enable GAP CSV import job | `true` |
| `APP_SEED_GAP_TARGET_COUNT` | Number of GAP products to import | `1000` |
| `APP_SEED_GAP_STYLES_PATH` | Path to `styles.csv` | `backend/src/main/resources/seeder/gap/styles.csv` |
| `APP_SEED_GAP_IMAGES_PATH` | Path to `images.csv` | `backend/src/main/resources/seeder/gap/images.csv` |
| `APP_SEED_GAP_CLEAN_BEFORE_IMPORT` | Clean previous `gap-*` batch before import | `true` |
| `JWT_SECRET` | JWT signing secret (required) | _none_ |
| `AZURE_BOT_AUTH_ENABLED` | Enable Azure bot auth | `false` |
| `APP_CHATBOT_AI_FALLBACK_ENABLED` | Enable AI fallback | `false` |

## Data Seeding and GAP Import
- Seeder and importer run on backend startup (depending on flags).
- GAP CSV source currently expected in:
  - `backend/src/main/resources/seeder/gap/styles.csv`
  - `backend/src/main/resources/seeder/gap/images.csv`
- Import runner maps data to existing category tree and creates products with variants/images.

## Crawl GAP Dataset
Crawler docs:
- `crawl/gap/README.md`

Main script:
- `crawl/gap/crawl-gap-products.mjs`

Typical run:
```bash
node crawl/gap/crawl-gap-products.mjs --target-count 1000 --headless true
```

## Quality Gates

Frontend scripts:
```bash
npm run lint --prefix frontend
npm run build --prefix frontend
npm run smoke --prefix frontend
```

CI workflow:
- `.github/workflows/frontend-quality-gate.yml`
- Runs: backend startup + health check, frontend lint/build, preview, Playwright smoke.
- Required repository secrets for smoke step:
  - `CI_JWT_SECRET`
  - `SMOKE_ADMIN_EMAIL`
  - `SMOKE_ADMIN_PASSWORD`
  - `SMOKE_VENDOR_EMAIL`
  - `SMOKE_VENDOR_PASSWORD`

## Main API Areas
- Auth: `/api/auth/*`
- Public marketplace: `/api/public/marketplace/*`
- Products/Categories/Stores: `/api/products/*`, `/api/categories/*`, `/api/stores/*`
- Orders/Returns/Reviews/Vouchers/Wallets: `/api/orders/*`, `/api/returns/*`, `/api/reviews/*`, `/api/vouchers/*`, `/api/wallets/*`
- Admin areas: `/api/admin/*`

## Troubleshooting

### Backend fails in CI with `Permission denied` on `./backend/mvnw`
Add:
```bash
chmod +x backend/mvnw
```

### Backend fails with Postgres auth error
Ensure workflow and DB service use the same credentials:
- `POSTGRES_PASSWORD`
- `DB_PASSWORD`

### Backend fails on Azure Bot config binding
If bot auth is disabled but fields are validated as non-blank, provide dummy `MicrosoftApp*` values.

### Mojibake / encoding issues
Run:
```bash
npm run check:utf8 --prefix frontend
```

---
Academic project note: this repository is used for study/demo purposes.
