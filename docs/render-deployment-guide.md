# Render Deployment Guide — Tech Tombola

This guide explains how to deploy the entire Tech Tombola system (Frontend SPA, Backend Fastify API, Real-Time WebSockets, and Database) on **Render** as a **single, unified service** using our all-in-one Docker configuration.

---

## 1. Architecture Overview (Single Platform on Render)

Instead of spinning up three separate billable services (static frontend, web service backend, and managed PostgreSQL), our unified Docker architecture consolidates the entire stack into a single container:

```text
[ Participant / Admin Browser ]
               │
               ▼ HTTPS (Render Public Domain / Port $PORT)
┌─────────────────────────────────────────────────────────────────┐
│ Render Web Service (Single Container)                          │
│                                                                 │
│  ┌────────────────────────┐                                     │
│  │ Nginx (Reverse Proxy)  │ :$PORT (Render Ingress)             │
│  │ - Serves React SPA     │                                     │
│  │ - Proxies /api/ & /ws  │                                     │
│  └───────────┬────────────┘                                     │
│              │ proxy_pass http://127.0.0.1:3000                 │
│              ▼                                                  │
│  ┌────────────────────────┐                                     │
│  │ Fastify + Bun Backend  │ :3000 (Internal)                    │
│  │ - Game Engine & Auth   │                                     │
│  │ - WebSocket Hub        │                                     │
│  └───────────┬────────────┘                                     │
│              │ postgresql://127.0.0.1:5432                      │
│              ▼                                                  │
│  ┌────────────────────────┐                                     │
│  │ Embedded PostgreSQL    │ :5432 (Internal)                    │
│  │ (or External DATABASE) │                                     │
│  └────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Highlights:
- **Zero CORS Issues**: The frontend and API are served from the exact same origin and port.
- **Auto-Provisioning**: On first boot, local PostgreSQL is initialized and database schema migrations run automatically.
- **Hybrid Database**: Uses embedded PostgreSQL by default (100% free single-service deployment), but seamlessly connects to Render Managed PostgreSQL if `DATABASE_URL` is configured.
- **WebSocket Ready**: Handles real-time Tombola game events with zero external message broker dependencies.

---

## 2. Deploy via Render Blueprint (`render.yaml`)

1. Fork or push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** → **Blueprint**.
3. Select your repository and click **Connect**.
4. Render will read `render.yaml` and configure the Web Service automatically with generated secure secrets (`JWT_SECRET`, `SESSION_SECRET`, `SUPER_ADMIN_BOOTSTRAP_SECRET`).
5. Click **Apply**. Render will build the Docker container and deploy the application.

---

## 3. Manual Web Service Deployment on Render

If you prefer to configure the service manually in the dashboard:

1. Click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** and connect this repository.
3. Choose the **`render`** branch.
4. Select **Docker** as the Runtime.
5. In **Environment Variables**, configure the following:

| Variable | Recommended Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Production optimizations |
| `JWT_SECRET` | *(Generate 32+ random characters)* | Token signing |
| `SESSION_SECRET` | *(Generate 32+ random characters)* | Session encryption |
| `SUPER_ADMIN_BOOTSTRAP_SECRET` | *(Generate 32+ random characters)* | Super Admin creation |
| `LOG_LEVEL` | `info` | Application logging |
| `EMAIL_FROM` | `noreply@techtombola.internal` | Sender address |
| `DATABASE_URL` | *(Optional)* | Only set if using external managed Postgres |

6. Click **Create Web Service**.

---

## 4. Persistent Disk (Optional)

If running embedded PostgreSQL on a paid Render plan (e.g. Starter) and you want data to persist across service restarts:
1. In the Web Service settings on Render, navigate to **Disks**.
2. Click **Add Disk**:
   - **Name**: `pgdata`
   - **Mount Path**: `/var/lib/postgresql/data`
   - **Size**: `1 GB` (or as needed)
3. Save changes.

---

## 5. Verification

Once deployed, visit your Render URL (e.g., `https://techtombola.onrender.com`):
- `/` — Loads the React landing page and Tombola game card.
- `/health` — Returns system health status.
- `/ready` — Returns HTTP 200 OK when database and backend are ready.
- `/ws` — Establishes real-time WebSocket connection.

---

## 6. Pre-Seeded Demo Accounts & Immediate Gameplay

On initial startup, Render automatically seeds **10 ready-to-use accounts**, an active event (**Tech Tombola 2026 — Main Stage**), an active round (**Round 1 — Core Computing & Systems**), 30 technical question/key pairs, 6 player tickets with 15 numbers each, and 2 initial draws (`DOCKER`, `LINUX`).

### Default Password:
```
Tombola@2026
```
*(Can be overridden with environment variable `SEED_DEFAULT_PASSWORD`)*

### Account Credentials:

| Role | Email | Password | Surface Route | Purpose |
|---|---|---|---|---|
| **Super Admin** (1) | `superadmin@techtombola.com` | `Tombola@2026` | `/admin` | Super Admin operations, manage admins, system settings |
| **Admin** (1 of 3) | `admin1@techtombola.com` | `Tombola@2026` | `/admin` | Event operations, drawing clues, verifying claims |
| **Admin** (2 of 3) | `admin2@techtombola.com` | `Tombola@2026` | `/admin` | Secondary event host |
| **Admin** (3 of 3) | `admin3@techtombola.com` | `Tombola@2026` | `/admin` | Secondary event host |
| **Player** (1 of 6) | `player1@techtombola.com` | `Tombola@2026` | `/participant` | Alice Player (Ticket with 15 tech keys) |
| **Player** (2 of 6) | `player2@techtombola.com` | `Tombola@2026` | `/participant` | Bob Player (Ticket with 15 tech keys) |
| **Player** (3 of 6) | `player3@techtombola.com` | `Tombola@2026` | `/participant` | Charlie Player (Ticket with 15 tech keys) |
| **Player** (4 of 6) | `player4@techtombola.com` | `Tombola@2026` | `/participant` | Diana Player (Ticket with 15 tech keys) |
| **Player** (5 of 6) | `player5@techtombola.com` | `Tombola@2026` | `/participant` | Evan Player (Ticket with 15 tech keys) |
| **Player** (6 of 6) | `player6@techtombola.com` | `Tombola@2026` | `/participant` | Fiona Player (Ticket with 15 tech keys) |

> [!TIP]
> On the `/login` page, you can click any of the **Demo Account chips** (Super Admin, Admin 1, Player 1, Player 2) to autofill the form with a single tap.
