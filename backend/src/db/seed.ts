import postgres from 'postgres';
import { hashPassword } from '../modules/auth/auth.domain.ts';
import { generateTicketLayout } from '../modules/tickets/ticket.domain.ts';

export const DEFAULT_SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Tombola@2026';

export const DEFAULT_ACCOUNTS = {
  superAdmin: {
    email: 'superadmin@techtombola.com',
    name: 'Super Admin',
    role: 'SUPER_ADMIN' as const,
  },
  admins: [
    { email: 'admin1@techtombola.com', name: 'Admin One', role: 'ADMIN' as const },
    { email: 'admin2@techtombola.com', name: 'Admin Two', role: 'ADMIN' as const },
    { email: 'admin3@techtombola.com', name: 'Admin Three', role: 'ADMIN' as const },
  ],
  players: [
    { email: 'player1@techtombola.com', name: 'Alice Player', externalId: 'TT-001' },
    { email: 'player2@techtombola.com', name: 'Bob Player', externalId: 'TT-002' },
    { email: 'player3@techtombola.com', name: 'Charlie Player', externalId: 'TT-003' },
    { email: 'player4@techtombola.com', name: 'Diana Player', externalId: 'TT-004' },
    { email: 'player5@techtombola.com', name: 'Evan Player', externalId: 'TT-005' },
    { email: 'player6@techtombola.com', name: 'Fiona Player', externalId: 'TT-006' },
  ],
};

export const QUESTION_BANK: { value: string; clue: string }[] = [
  { value: 'DOCKER', clue: 'Containerization platform using namespaces and cgroups to isolate applications.' },
  { value: 'KUBERNETES', clue: 'Container orchestration system originally designed by Google.' },
  { value: 'POSTGRESQL', clue: 'Advanced open-source relational database known for reliability and extensibility.' },
  { value: 'LINUX', clue: 'Unix-like operating system kernel created by Linus Torvalds in 1991.' },
  { value: 'REDIS', clue: 'In-memory key-value data structure store used as a database, cache, and broker.' },
  { value: 'GRAPHQL', clue: 'API query language created by Meta that allows clients to request exact data shapes.' },
  { value: 'TYPESCRIPT', clue: 'Typed superset of JavaScript that compiles to plain JavaScript.' },
  { value: 'RUST', clue: 'Systems programming language focused on memory safety without garbage collection.' },
  { value: 'PYTHON', clue: 'High-level language known for clean syntax, widely used in AI, ML, and automation.' },
  { value: 'FASTIFY', clue: 'High-performance web framework focused on low overhead and plugin architecture.' },
  { value: 'REACT', clue: 'Frontend library for building component-driven user interfaces with a virtual DOM.' },
  { value: 'WEBSOCKET', clue: 'Bidirectional full-duplex communication protocol over a single TCP connection.' },
  { value: 'NGINX', clue: 'High-performance HTTP server, reverse proxy, and load balancer.' },
  { value: 'GIT', clue: 'Distributed version control system created for tracking code changes.' },
  { value: 'BUN', clue: 'All-in-one JavaScript runtime, bundler, test runner, and package manager built with Zig.' },
  { value: 'ARGON2', clue: 'Password-hashing function selected as winner of the Password Hashing Competition.' },
  { value: 'KAFKA', clue: 'Distributed event streaming platform capable of handling trillions of events.' },
  { value: 'TERRAFORM', clue: 'Infrastructure as Code tool by HashiCorp using declarative configuration files.' },
  { value: 'PROMETHEUS', clue: 'Open-source systems monitoring and alerting toolkit with time series data.' },
  { value: 'GRAFANA', clue: 'Open-source analytics and interactive visualization platform.' },
  { value: 'CLOUDFLARE', clue: 'Global edge network providing CDN, DDoS mitigation, and DNS services.' },
  { value: 'HTTP2', clue: 'Major revision of HTTP introducing multiplexed streams and binary framing.' },
  { value: 'OAUTH2', clue: 'Industry-standard authorization framework enabling delegated third-party access.' },
  { value: 'GRPC', clue: 'Universal RPC framework developed by Google using Protocol Buffers.' },
  { value: 'BASH', clue: 'Unix shell and command language written for the GNU Project.' },
  { value: 'DRIZZLE', clue: 'TypeScript ORM with SQL-like syntax providing type safety with zero overhead.' },
  { value: 'CURL', clue: 'Command-line tool and library for transferring data using network protocols.' },
  { value: 'VITE', clue: 'Frontend tooling leveraging native ES modules for instant hot module replacement.' },
  { value: 'GSAP', clue: 'High-speed JavaScript animation library for interactive web experiences.' },
  { value: 'ZOD', clue: 'TypeScript-first schema declaration and validation library with static typing.' },
];

export interface SeedResult {
  seeded: boolean;
  message: string;
  superAdminEmail?: string;
  adminEmails?: string[];
  playerEmails?: string[];
  eventId?: string;
  roundId?: string;
}

export async function runSeed(overrideUrl?: string): Promise<SeedResult> {
  const url = overrideUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/techtombola';
  const sql = postgres(url, { max: 1, connect_timeout: 5 });

  try {
    // 1. Idempotency Check
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE email = ${DEFAULT_ACCOUNTS.superAdmin.email} LIMIT 1;
    `;
    if (existing.length > 0) {
      return {
        seeded: false,
        message: `Database already seeded (${DEFAULT_ACCOUNTS.superAdmin.email} exists).`,
      };
    }

    const passwordHash = await hashPassword(DEFAULT_SEED_PASSWORD);

    return await sql.begin(async (tx) => {
      // 2. Create Super Admin
      const [superAdmin] = await tx<{ id: string }[]>`
        INSERT INTO users (email, password_hash, name, status)
        VALUES (${DEFAULT_ACCOUNTS.superAdmin.email}, ${passwordHash}, ${DEFAULT_ACCOUNTS.superAdmin.name}, 'ACTIVE')
        RETURNING id;
      `;
      await tx`
        INSERT INTO admin_profiles (user_id, role)
        VALUES (${superAdmin!.id}, ${DEFAULT_ACCOUNTS.superAdmin.role});
      `;

      // 3. Create 3 Admins
      const adminEmails: string[] = [];
      for (const adm of DEFAULT_ACCOUNTS.admins) {
        const [user] = await tx<{ id: string }[]>`
          INSERT INTO users (email, password_hash, name, status)
          VALUES (${adm.email}, ${passwordHash}, ${adm.name}, 'ACTIVE')
          RETURNING id;
        `;
        await tx`
          INSERT INTO admin_profiles (user_id, role)
          VALUES (${user!.id}, ${adm.role});
        `;
        adminEmails.push(adm.email);
      }

      // 4. Create Active Event
      const [event] = await tx<{ id: string }[]>`
        INSERT INTO events (title, description, status, scheduled_at, started_at)
        VALUES (
          'Tech Tombola 2026 — Main Stage',
          'Annual MUACM flagship technology tombola tournament.',
          'LIVE',
          NOW(),
          NOW()
        )
        RETURNING id;
      `;

      // 5. Create 6 Players / Participants
      const playerEmails: string[] = [];
      const participantIds: string[] = [];
      for (const p of DEFAULT_ACCOUNTS.players) {
        const [user] = await tx<{ id: string }[]>`
          INSERT INTO users (email, password_hash, name, status)
          VALUES (${p.email}, ${passwordHash}, ${p.name}, 'ACTIVE')
          RETURNING id;
        `;
        const [participant] = await tx<{ id: string }[]>`
          INSERT INTO participant_profiles (user_id, event_id, external_id, status, email_delivery_status)
          VALUES (${user!.id}, ${event!.id}, ${p.externalId}, 'ACTIVE', 'SENT')
          RETURNING id;
        `;
        playerEmails.push(p.email);
        participantIds.push(participant!.id);
      }

      // 6. Create Round 1 (ACTIVE)
      const [round] = await tx<{ id: string }[]>`
        INSERT INTO rounds (event_id, sequence_number, name, status)
        VALUES (${event!.id}, 1, 'Round 1 — Core Computing & Systems', 'ACTIVE')
        RETURNING id;
      `;

      // 7. Create Round Patterns (All 5 OPEN)
      for (const pattern of ['EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE']) {
        await tx`
          INSERT INTO round_patterns (round_id, pattern_type, enabled, max_winners, status)
          VALUES (${round!.id}, ${pattern}, true, 1, 'OPEN');
        `;
      }

      // 8. Insert Keys & Questions
      const insertedKeys: { id: string; value: string }[] = [];
      const insertedQuestions: { id: string; keyId: string; questionText: string; keyValue: string }[] = [];

      for (const q of QUESTION_BANK) {
        const normalized = q.value.trim().toUpperCase();
        const [k] = await tx<{ id: string; value: string }[]>`
          INSERT INTO event_keys (event_id, value, normalized_value)
          VALUES (${event!.id}, ${q.value}, ${normalized})
          RETURNING id, value;
        `;
        insertedKeys.push({ id: k!.id, value: k!.value });

        const [rq] = await tx<{ id: string }[]>`
          INSERT INTO round_questions (round_id, key_id, question_text)
          VALUES (${round!.id}, ${k!.id}, ${q.clue})
          RETURNING id;
        `;
        insertedQuestions.push({
          id: rq!.id,
          keyId: k!.id,
          questionText: q.clue,
          keyValue: q.value,
        });
      }

      // 9. Generate & Allocate Valid 3x9 Tickets for all 6 Players
      for (let i = 0; i < participantIds.length; i++) {
        const participantId = participantIds[i]!;
        const [ticket] = await tx<{ id: string }[]>`
          INSERT INTO tickets (round_id, participant_id, event_id)
          VALUES (${round!.id}, ${participantId}, ${event!.id})
          RETURNING id;
        `;

        const layout = generateTicketLayout({
          keys: insertedKeys,
          seed: `seed-ticket-${i}-${participantId}`,
        });

        for (const cell of layout.cells) {
          await tx`
            INSERT INTO ticket_cells (ticket_id, key_id, row_index, col_index)
            VALUES (${ticket!.id}, ${cell.keyId}, ${cell.rowIndex}, ${cell.colIndex});
          `;
        }
      }

      // 10. Initial Draws (First 2 questions drawn to activate live feed and player markability)
      for (let seq = 1; seq <= 2; seq++) {
        const q = insertedQuestions[seq - 1]!;
        await tx`
          INSERT INTO draws (round_id, question_id, key_id, sequence_number, draw_mode, question_text, key_value, drawn_by)
          VALUES (${round!.id}, ${q.id}, ${q.keyId}, ${seq}, 'RANDOM', ${q.questionText}, ${q.keyValue}, ${superAdmin!.id});
        `;
      }

      // 11. Audit Record
      await tx`
        INSERT INTO audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
        VALUES (
          ${superAdmin!.id},
          'SUPER_ADMIN',
          'SYSTEM_BOOTSTRAPPED',
          'system',
          ${event!.id},
          '{"superAdmin":1,"admins":3,"players":6,"event":"LIVE","round":"ACTIVE","draws":2}'
        );
      `;

      return {
        seeded: true,
        message: 'Successfully seeded 10 accounts, live event, active round, 30 clues, 6 tickets, and 2 initial draws.',
        superAdminEmail: DEFAULT_ACCOUNTS.superAdmin.email,
        adminEmails,
        playerEmails,
        eventId: event!.id,
        roundId: round!.id,
      };
    });
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  try {
    const result = await runSeed();
    console.log('----------------------------------------------------');
    console.log('           TECH TOMBOLA DATABASE SEEDER             ');
    console.log('----------------------------------------------------');
    console.log(`=> Result: ${result.message}`);
    if (result.seeded) {
      console.log(`=> Default Password: ${DEFAULT_SEED_PASSWORD}`);
      console.log(`=> Super Admin: ${DEFAULT_ACCOUNTS.superAdmin.email}`);
      console.log(`=> Admins (3):  ${DEFAULT_ACCOUNTS.admins.map((a) => a.email).join(', ')}`);
      console.log(`=> Players (6): ${DEFAULT_ACCOUNTS.players.map((p) => p.email).join(', ')}`);
    }
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('Seed execution failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
