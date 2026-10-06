# 0002. Native WebSockets over Redis and Socket.IO

## Context
During live rounds, 400–500 participants and projector displays must receive draw reveals and win announcements with sub-second latency. We considered Socket.IO and distributed pub/sub infrastructure like Redis or Kafka.

## Decision
We chose **Native WebSockets (`@fastify/websocket`)** managed in-memory on the Node.js server without external brokers (no Redis, no Socket.IO, no Kafka).

## Consequences
- Zero external messaging broker dependencies, keeping infrastructure minimal and eliminating Redis connection failure modes during live games.
- A single Node.js Fastify instance comfortably maintains ~500 open WebSocket connections and broadcasts draw events in <100ms.
- Real-time events are broadcast-only; client connections never dictate or mutate game state directly via WebSocket. If horizontal scaling is required in the future, a pub/sub adapter can be introduced behind the existing transport interface.
