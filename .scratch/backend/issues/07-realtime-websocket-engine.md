# 07 — Native Real-Time WebSocket Transport

**What to build:** In-memory Fastify native WebSocket server (`@fastify/websocket`) on Bun providing real-time event broadcasting to participants, admins, and live displays with zero external broker dependencies (no Redis, no Socket.IO).

**Blocked by:** 02 — Authentication and Role-Based Authorization

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] In-memory WebSocket manager registered via `@fastify/websocket` on `/api/v1/ws`.
- [ ] Connection authentication:
  - Validates client JWT token provided during handshake query/header.
  - Rejects unauthenticated connections with code 4401.
  - Subscribes connection to round rooms and role-specific channels (e.g., admin-only vs public broadcast).
- [ ] Connection lifecycle management:
  - Tracks open client connections in memory.
  - Handles heartbeats (ping/pong) to detect dead sockets and evict cleanly.
  - Supports up to 500 simultaneous client sockets on a single Bun instance.
- [ ] Strongly typed event broadcast dispatcher supporting PRD event types:
  - `ROUND_STARTED`
  - `ROUND_PAUSED`
  - `ROUND_RESUMED`
  - `DRAW_CREATED`
  - `WIN_CLAIM_CREATED` (dispatched strictly to authenticated admin connections)
  - `WINNER_VERIFIED`
  - `ROUND_COMPLETED`
  - `ANNOUNCEMENT`
- [ ] Unit tests verify connection authentication parsing, room subscription, and message serialization.
- [ ] Integration tests verify connection establishment, heartbeat responses, targeted broadcast to round clients, and admin-only event isolation.
