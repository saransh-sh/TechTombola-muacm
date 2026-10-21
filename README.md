# Tech Tombola 🎟️⚡

> A high-concurrency, technology-themed digital Tombola (Housie/Bingo) engine engineered for live campus events of 400–500 simultaneous participants.

[![Bun](https://img.shields.io/badge/Bun-1.x-fbf0df?style=flat&logo=bun&logoColor=black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?style=flat&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-19.x-61dafb?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646cff?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169e1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![WebSocket](https://img.shields.io/badge/Real--time-WebSocket-010101?style=flat&logo=websocket&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📑 Table of Contents

- [📌 Overview & Concept](#-overview--concept)
  - [⚠️ The Golden Rule: Not a Quiz](#️-the-golden-rule-tech-tombola-is-not-a-quiz)
- [🎮 User Portals & Application Flow](#-user-portals--application-flow)
- [🏆 Winning Patterns](#-winning-patterns)
- [🏗️ System Architecture](#️-system-architecture)
  - [Modular Monolith Layers](#modular-monolith-layer-boundaries)
  - [Real-Time Protocol](#real-time-websocket-architecture)
- [📂 Repository Directory Structure](#-repository-directory-structure)
- [⚡ Quick Start: Local Development](#-quick-start-local-development)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone & Environment Setup](#2-clone--environment-setup)
  - [3. Backend Setup & Database Migration](#3-backend-setup--database-migration)
  - [4. Frontend Setup](#4-frontend-setup)
- [🧪 Testing & Quality Verification](#-testing--quality-verification)
- [🐳 Production Deployment (VPS Docker Compose)](#-production-deployment-vps-docker-compose)
- [🔒 Critical Game Invariants](#-critical-game-invariants)
- [📚 Documentation Index](#-documentation-index)
- [📄 License](#-license)

---

## 📌 Overview & Concept

**Tech Tombola** transforms traditional Tombola (Bingo/Housie) into an interactive, digital, tech-centric competition for developer events. Built with a modular monolith architecture, it is purpose-built to deliver sub-100ms real-time state synchronization, verifiable ticket generation, and automated win eligibility checks within tight infrastructure budgets (single VPS, no Redis/Kafka clusters required).

### ⚠️ The Golden Rule: Tech Tombola is NOT a Quiz

> **A question is simply a clue.** Its corresponding answer (**the "key"**) is officially revealed by the game engine. Participants find that key on their ticket and manually mark it. **Participants do NOT submit answers to questions.**

```
       [ Question / Clue ]
                │
                ▼
      [ Predefined Key (Answer) ]
                │
                ▼
  [ Revealed by Game Engine (Draw) ]
                │
                ▼
 [ Participant finds Key on Ticket ]
                │
                ▼
    [ Participant Marks Cell ]
                │
                ▼
 [ Server Evaluates Winning Pattern ]
```

**Example in Play:**
- **Clue / Question:** *"What is the containerization platform symbolized by a blue whale?"*
- **Key (Answer):** `DOCKER`
- If `DOCKER` exists on a player's ticket, they can tap and mark that cell once the engine reveals the draw!

---

## 🎮 User Portals & Application Flow

The frontend provides dedicated views tailored to each role in the live event:

| Surface / Route | Intended Audience | Purpose & Features |
|---|---|---|
| **`/` (Landing Page)** | Everyone | Visual hero presentation, interactive 3×9 Tombola card simulator, rules explainer, and quick navigation to portals. |
| **`/login`** | Authenticated Users | Cookie-based session authentication with automatic role-based redirect. |
| **`/game` & `/ticket`** | Participants | Mobile-first 3×9 Tombola card with tactile cell marking, live draw stream, and one-tap claim submissions. |
| **`/claims` & `/results`** | Participants | Live view of personal claims, adjudication status, and official round winners. |
| **`/live`** | Host / Projector Display | Large-format, read-only projector view displaying current draw clues, answer keys, recent history, and verified winners. |
| **`/admin/*`** | Event Operations Staff | Full control room: start/pause/resume rounds, trigger random/manual draws, review and adjudicate claims, manage questions and keys. |
| **`/admin/super-admin`** | Super Administrators | Administrator account provisioning, system health monitoring, and recovery operations. |

---

## 🏆 Winning Patterns

Tech Tombola supports traditional Tombola winning patterns, automatically evaluated and audited server-side:

| Pattern | Code | Description |
|---|---|---|
| **Early 5** | `EARLY_5` | First participant(s) to correctly mark any 5 valid drawn keys across their ticket. |
| **Top Line** | `TOP_LINE` | All 5 populated keys in Row 1 (top row) marked. |
| **Middle Line** | `MIDDLE_LINE` | All 5 populated keys in Row 2 (middle row) marked. |
| **Bottom Line** | `BOTTOM_LINE` | All 5 populated keys in Row 3 (bottom row) marked. |
| **Full House** | `FULL_HOUSE` | All 15 populated keys across the entire 3×9 ticket marked. |

---

## 🏗️ System Architecture

Tech Tombola adopts a **Modular Monolith** architecture governed by strict layer boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│   React 19 + TypeScript + Vite 7 + GSAP + TanStack Query    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST & Native WebSocket
┌──────────────────────────────▼──────────────────────────────┐
│                  Backend (Bun + Fastify 5)                  │
│                                                             │
│   ┌──────────────┐     ┌──────────────┐    ┌────────────┐   │
│   │ Route Layer  │ ──> │ Service Layer│ ──>│   Domain   │   │
│   │(Zod Validate)│     │(Orchestration)│    │(Game Rules)│   │
│   └──────────────┘     └──────┬───────┘    └─────▲──────┘   │
│                               │                  │          │
│                        ┌──────▼───────┐          │          │
│                        │  Repository  │──────────┘          │
│                        │ (Drizzle/SQL)│                     │
│                        └──────┬───────┘                     │
└───────────────────────────────┼─────────────────────────────┘
                                │
                        ┌───────▼────────┐
                        │   PostgreSQL   │
                        └────────────────┘
```

### Modular Monolith Layer Boundaries

- **`routes/`**: Handles HTTP / WebSocket transport, enforces schema validation with Zod, and routes requests to domain services. Contains zero business state mutation logic.
- **`service/`**: Coordinates application use cases, database transactions, email dispatch, and WebSocket broadcast triggers.
- **`domain/`**: Pure TypeScript modules containing authoritative business rules (ticket generator invariants, draw engine randomness, pattern verification). Pure logic with zero database or framework dependencies.
- **`repository/`**: Data access layer executing SQL queries and transactions via Drizzle ORM against PostgreSQL.

### Real-Time WebSocket Architecture

Real-time synchronization uses native Fastify WebSockets (`@fastify/websocket`) with sub-100ms broadcast latency.
- **WebSocket Route:** `/ws`
- **Supported Events:**
  - `ROUND_STARTED` — Round has officially begun
  - `ROUND_PAUSED` / `ROUND_RESUMED` — Live round paused or resumed
  - `DRAW_CREATED` — New question & answer key pair revealed
  - `WIN_CLAIM_CREATED` — A participant submitted a winning claim
  - `WINNER_VERIFIED` — Claim verified; winner officially confirmed
  - `ROUND_COMPLETED` — Round concluded
  - `ANNOUNCEMENT` — Operational announcement to all connected clients

---

## 📂 Repository Directory Structure

```text
TechTombola-muacm/
├── backend/                       # Fastify 5 + Bun modular monolith
│   ├── src/
│   │   ├── config/                # Environment schema and runtime config
│   │   ├── db/                    # Drizzle client, migrations, and table schemas
│   │   │   └── schema/            # Database tables (users, tickets, draws, rounds, etc.)
│   │   ├── modules/               # Domain feature modules
│   │   │   ├── audit/             # Append-only audit logging & querying
│   │   │   ├── auth/              # Cookie sessions, password hashing, role guards
│   │   │   ├── claims/            # Win claims and verification engine
│   │   │   ├── events/            # Event lifecycle management
│   │   │   ├── live/              # Projector display serializers and endpoints
│   │   │   ├── marks/             # Server-confirmed cell marking
│   │   │   ├── operations/        # Admin metrics, dashboard, and health
│   │   │   ├── participants/      # Participant management & CSV onboarding
│   │   │   ├── questions/         # Question bank & answer keys
│   │   │   ├── recovery/          # Crash recovery & state consistency engine
│   │   │   ├── rounds/            # Round lifecycle & pattern configuration
│   │   │   └── tickets/           # 3×9 card generator & layout validator
│   │   ├── realtime/              # WebSocket transport & event broadcast manager
│   │   ├── shared/                # Cross-cutting utilities (errors, email, logger)
│   │   └── server.ts              # Fastify server entry point
│   ├── tests/
│   │   ├── unit/                  # Pure unit tests (domain logic, ticket generator, win engine)
│   │   ├── integration/           # HTTP API contract tests with Supertest
│   │   ├── security/              # Authentication, authorization, and CORS matrix tests
│   │   ├── load/                  # 500-participant load qualification tests
│   │   └── deployment/            # Docker container verification tests
│   ├── Dockerfile                 # Production backend container build
│   └── package.json
│
├── frontend/                      # React 19 + Vite 7 SPA
│   ├── src/
│   │   ├── features/              # Feature-oriented UI modules
│   │   │   ├── admin/             # Operations dashboard, claims adjudicator, round controls
│   │   │   ├── auth/              # Login screen and authentication provider
│   │   │   ├── landing/           # Hero landing page, sample ticket interactive simulator
│   │   │   ├── live/              # Projector & host live display board
│   │   │   └── participant/       # 3×9 Tombola card, tap marking, claims drawer
│   │   ├── lib/                   # API clients, WebSocket managers, auth store
│   │   ├── styles/                # Global CSS tokens and resets
│   │   ├── App.tsx                # Route definitions & layout boundaries
│   │   └── main.tsx               # Application root
│   ├── design/                    # UI specifications and component design docs
│   ├── e2e/                       # Playwright browser end-to-end tests
│   ├── nginx.conf                 # Production Nginx reverse-proxy configuration
│   ├── Dockerfile                 # Multi-stage production frontend container build
│   └── package.json
│
├── docs/                          # Comprehensive specifications and guidelines
│   ├── adr/                       # Architectural Decision Records (ADRs)
│   ├── ARCHITECTURE_CODING_STANDARDS.md  # System guidelines and API designs
│   ├── TECH_TOMBOLA_BACKEND_PRD.md       # Complete backend specification
│   ├── TECH_TOMBOLA_FRONTEND_PRD.md      # Complete frontend specification
│   └── vps-deployment-guide.md           # Step-by-step VPS hosting & SSL guide
│
├── .cursor/rules/                 # AI assistant engineering guardrails
├── AGENTS.md                      # Instructions for autonomous AI coding agents
├── CONTEXT.md                     # Canonical domain terminology glossary
├── docker-compose.yml             # Full-stack production deployment manifest
├── .gitignore                     # Git ignore rules
└── README.md                      # Project documentation (this file)
```

---

## ⚡ Quick Start: Local Development

### 1. Prerequisites

- [Bun](https://bun.sh/) (v1.1+) installed
- [PostgreSQL](https://www.postgresql.org/) (v16+) running locally or via Docker
- Node.js (optional, Bun runs all scripts directly)

### 2. Clone & Environment Setup

```bash
# Clone the repository
git clone https://github.com/saransh-sh/TechTombola-muacm.git
cd TechTombola-muacm

# Copy environment configuration
cp .env.example .env
cp backend/.env.example backend/.env
```

Edit `.env` and `backend/.env` to configure your PostgreSQL credentials and secrets:
```env
DATABASE_URL=postgres://tombola_user:tombola_pass@localhost:5432/tech_tombola
PORT=3000
HOST=127.0.0.1
JWT_SECRET=replace_with_at_least_32_characters_random_secret_jwt
SESSION_SECRET=replace_with_at_least_32_characters_random_secret_session
SUPER_ADMIN_BOOTSTRAP_SECRET=replace_with_at_least_32_characters_bootstrap_secret
```

### 3. Backend Setup & Database Migration

```bash
cd backend

# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Start backend in watch mode (runs on http://localhost:3000)
bun run dev
```

### 4. Frontend Setup

In a new terminal window:

```bash
cd frontend

# Install dependencies
bun install

# Start Vite development server (runs on http://localhost:5173)
bun run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) to see the interactive landing page and ticket simulator!

---

## 🧪 Testing & Quality Verification

Tech Tombola adheres to strict test-driven engineering standards. Tests are mandatory for every domain module and route.

| Suite | Scope | Command |
|---|---|---|
| **Frontend Unit & Component** | All React components, hooks, stores, and API clients | `cd frontend && bun run test` |
| **Frontend Coverage** | Full test coverage report with Vitest | `cd frontend && bun run test:coverage` |
| **Backend Pure Domain** | Ticket layout generator, win engine, pattern invariants | `cd backend && bun test tests/unit` |
| **Backend Unit & Routes** | Application shell, live routes, recovery, auth guards | `cd backend && bun run test` |
| **Backend Security Matrix** | Role guards, CORS preflight, session revocation | `cd backend && bun run test:security` |
| **Frontend E2E** | Full browser workflow tests with Playwright | `cd frontend && bun run test:e2e` |

---

## 🐳 Production Deployment (VPS Docker Compose)

The entire system (Frontend, Backend, and PostgreSQL database) is containerized and deployable to any single VPS in minutes:

```bash
# 1. Clone on VPS
git clone https://github.com/saransh-sh/TechTombola-muacm.git
cd TechTombola-muacm

# 2. Configure production secrets
cp .env.example .env
nano .env   # Generate secrets with: openssl rand -hex 24

# 3. Launch Docker Compose stack
docker compose up -d --build

# 4. Verify system readiness
docker compose ps
curl http://localhost/ready
```

For complete instructions on Nginx reverse proxy configuration, Let's Encrypt SSL, automated database backups, and Super Admin account creation, see the [VPS Deployment & Operations Guide](docs/vps-deployment-guide.md).

---

## 🔒 Critical Game Invariants

These invariants are strictly enforced by the backend game engine and verified by automated regression tests:

1. **Ticket Assignment Invariance:** A participant has exactly one ticket assigned per round.
2. **Key Uniqueness per Ticket:** A ticket never contains duplicate keys across its 15 cells.
3. **Traditional 3×9 Format:** Every ticket has exactly 3 rows × 9 columns with exactly 5 populated keys per row (15 keys total).
4. **Draw Uniqueness:** A question/key cannot be drawn more than once within the same round.
5. **Mark Validity:** A participant cannot mark an undrawn key.
6. **Server-Side Win Eligibility:** No claim can be awarded without server-side verification against draw and mark history.
7. **Pattern Closure:** Once a winning pattern's prize slots are filled, the pattern is permanently closed.
8. **Crash Safety:** An interrupted or crashed round automatically recovers to `RECOVERY_REQUIRED` and cannot resume without validation.
9. **Immutable Audit Trail:** Historical draws, marks, and verified wins cannot be modified or deleted.
10. **Data Privacy:** Participants cannot view other participants' tickets, marks, or personal data.
11. **Future Key Protection:** Undrawn questions and future answer keys are never transmitted to client devices.
12. **Credential Security:** Plaintext passwords are never persisted; all credentials use Argon2id hashing.

---

## 📚 Documentation Index

- [`docs/TECH_TOMBOLA_BACKEND_PRD.md`](docs/TECH_TOMBOLA_BACKEND_PRD.md) — Complete backend specification, data schemas, and API contracts.
- [`docs/TECH_TOMBOLA_FRONTEND_PRD.md`](docs/TECH_TOMBOLA_FRONTEND_PRD.md) — Complete frontend UX/UI specification and component contracts.
- [`docs/ARCHITECTURE_CODING_STANDARDS.md`](docs/ARCHITECTURE_CODING_STANDARDS.md) — Layer boundaries, coding rules, and error handling conventions.
- [`docs/vps-deployment-guide.md`](docs/vps-deployment-guide.md) — Production Docker Compose VPS setup and maintenance procedures.
- [`CONTEXT.md`](CONTEXT.md) — Authoritative domain vocabulary and terminology glossary.
- [`AGENTS.md`](AGENTS.md) — Development conventions and 16-step execution workflow for AI assistants.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
