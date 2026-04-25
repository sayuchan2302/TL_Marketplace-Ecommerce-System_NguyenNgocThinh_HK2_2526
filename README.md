<div align="center">

# 👗 Fashion Marketplace

A full-stack e-commerce platform for fashion products with multi-role support.

**Spring Boot** · **React 19** · **TypeScript** · **PostgreSQL**

</div>

---

## Overview

Fashion Marketplace is a multi-vendor e-commerce system with three core roles:

| Role | Capabilities |
|------|-------------|
| **Customer** | Browse, search, cart, checkout, order tracking, reviews |
| **Vendor** | Product & order management, promotions, wallet/payout |
| **Admin** | User/store moderation, categories, returns, vouchers, dashboard |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Java 21, Spring Boot 3.2, Spring Security, Spring Data JPA, WebSocket |
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 3, Recharts, Framer Motion |
| **Database** | PostgreSQL 16+ |
| **Testing** | ESLint, Playwright, Smoke Regression |
| **CI/CD** | GitHub Actions |

## Project Structure

```
.
├── backend/             # Spring Boot REST API
│   ├── src/main/java/   # Application source
│   └── src/main/resources/
├── frontend/            # React + Vite SPA
│   ├── src/             # Components, pages, hooks
│   ├── scripts/         # Utility scripts
│   └── tests/           # Playwright tests
├── crawl/gap/           # GAP dataset crawler
└── .github/workflows/   # CI pipelines
```

## Getting Started

### Prerequisites

- **Java** 21
- **Node.js** 20+
- **PostgreSQL** 16+
- **npm** (bundled with Node.js)

### 1. Clone & Install

```bash
git clone <repo-url>
cd <repo-folder>
npm ci --prefix frontend
```

### 2. Database Setup

Create a PostgreSQL database named `fashion-store`:

```sql
CREATE DATABASE "fashion-store";
```

### 3. Environment Variables

Copy the example files and fill in your values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

<details>
<summary><strong>Backend</strong> — <code>backend/.env</code></summary>

```env
# Required
DB_URL=jdbc:postgresql://localhost:5432/fashion-store
DB_USERNAME=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_long_random_secret

# Data seeding (optional)
APP_SEED_ENABLED=true
APP_SEED_GAP_ENABLED=true
APP_SEED_GAP_TARGET_COUNT=1000
APP_SEED_GAP_CLEAN_BEFORE_IMPORT=true

# Azure Bot — set dummy values if disabled
AZURE_BOT_AUTH_ENABLED=false
MicrosoftAppId=00000000-0000-0000-0000-000000000000
MicrosoftAppPassword=dummy-secret
MicrosoftAppTenantId=00000000-0000-0000-0000-000000000000
```

</details>

<details>
<summary><strong>Frontend</strong> — <code>frontend/.env</code></summary>

```env
VITE_API_URL=http://localhost:8080
```

</details>

### 4. Run

**Backend:**

```bash
# Windows
backend\mvnw.cmd -f backend/pom.xml spring-boot:run

# macOS / Linux
chmod +x backend/mvnw
./backend/mvnw -f backend/pom.xml spring-boot:run
```

**Frontend:**

```bash
npm run dev --prefix frontend
```

### 5. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Health Check | http://localhost:8080/actuator/health |

## API Reference

| Area | Endpoint |
|------|----------|
| Auth | `/api/auth/*` |
| Marketplace | `/api/public/marketplace/*` |
| Products | `/api/products/*` |
| Categories | `/api/categories/*` |
| Stores | `/api/stores/*` |
| Orders | `/api/orders/*` |
| Returns | `/api/returns/*` |
| Reviews | `/api/reviews/*` |
| Vouchers | `/api/vouchers/*` |
| Wallets | `/api/wallets/*` |
| Admin | `/api/admin/*` |

> Full API documentation available at `/swagger-ui.html` when the backend is running.

## Data Seeding

The backend includes an automatic data seeding pipeline:

- **Base seeder** — creates default users, categories, and sample data on startup.
- **GAP importer** — imports products from GAP CSV datasets (`styles.csv`, `images.csv`).

Both run on startup based on environment flags. See [Configuration](#configuration) below.

<details>
<summary><strong>GAP Dataset Crawler</strong></summary>

```bash
node crawl/gap/crawl-gap-products.mjs --target-count 1000 --headless true
```

See [`crawl/gap/README.md`](crawl/gap/README.md) for full documentation.

</details>

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_SEED_ENABLED` | Enable base data seeding | `true` |
| `APP_SEED_GAP_ENABLED` | Enable GAP CSV import | `true` |
| `APP_SEED_GAP_TARGET_COUNT` | Products to import | `1000` |
| `APP_SEED_GAP_CLEAN_BEFORE_IMPORT` | Clean previous import batch | `true` |
| `JWT_SECRET` | JWT signing secret | — |
| `AZURE_BOT_AUTH_ENABLED` | Enable Azure Bot auth | `false` |
| `APP_CHATBOT_AI_FALLBACK_ENABLED` | Enable AI chatbot fallback | `false` |

## Quality Gates

```bash
npm run lint   --prefix frontend   # Lint + UTF-8 check
npm run build  --prefix frontend   # Type check + production build
npm run smoke  --prefix frontend   # Playwright smoke tests
```

**CI Pipeline** (`.github/workflows/frontend-quality-gate.yml`):
- Backend startup + health check
- Frontend lint & build
- Playwright smoke regression

<details>
<summary><strong>Required CI Secrets</strong></summary>

| Secret | Purpose |
|--------|---------|
| `CI_JWT_SECRET` | JWT token for CI environment |
| `SMOKE_ADMIN_EMAIL` | Admin test account email |
| `SMOKE_ADMIN_PASSWORD` | Admin test account password |
| `SMOKE_VENDOR_EMAIL` | Vendor test account email |
| `SMOKE_VENDOR_PASSWORD` | Vendor test account password |

</details>

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Permission denied` on `./backend/mvnw` | Run `chmod +x backend/mvnw` |
| PostgreSQL auth error in CI | Ensure `POSTGRES_PASSWORD` matches `DB_PASSWORD` |
| Azure Bot config binding error | Set dummy `MicrosoftApp*` values when `AZURE_BOT_AUTH_ENABLED=false` |
| Mojibake / encoding issues | Run `npm run check:utf8 --prefix frontend` |

---

<div align="center">
<sub>Academic project — built for study and demonstration purposes.</sub>
</div>
