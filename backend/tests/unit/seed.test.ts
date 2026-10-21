import { describe, expect, it } from 'bun:test';
import { DEFAULT_ACCOUNTS, DEFAULT_SEED_PASSWORD, QUESTION_BANK } from '../../src/db/seed.ts';
import { generateTicketLayout } from '../../src/modules/tickets/ticket.domain.ts';
import { verifyPassword, hashPassword } from '../../src/modules/auth/auth.domain.ts';

describe('Database Seed Invariants and Specification', () => {
  it('specifies exactly 1 Super Admin, 3 Admins, and 6 Players (total 10 accounts)', () => {
    expect(DEFAULT_ACCOUNTS.superAdmin).toBeDefined();
    expect(DEFAULT_ACCOUNTS.superAdmin.role).toBe('SUPER_ADMIN');

    expect(DEFAULT_ACCOUNTS.admins).toHaveLength(3);
    for (const admin of DEFAULT_ACCOUNTS.admins) {
      expect(admin.role).toBe('ADMIN');
      expect(admin.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }

    expect(DEFAULT_ACCOUNTS.players).toHaveLength(6);
    for (const player of DEFAULT_ACCOUNTS.players) {
      expect(player.externalId).toBeDefined();
      expect(player.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }

    const allEmails = [
      DEFAULT_ACCOUNTS.superAdmin.email,
      ...DEFAULT_ACCOUNTS.admins.map((a) => a.email),
      ...DEFAULT_ACCOUNTS.players.map((p) => p.email),
    ];
    expect(allEmails).toHaveLength(10);
    expect(new Set(allEmails).size).toBe(10);
  });

  it('provides a default password meeting Argon2 length requirements (>= 8 characters)', async () => {
    expect(DEFAULT_SEED_PASSWORD.length).toBeGreaterThanOrEqual(8);
    const hash = await hashPassword(DEFAULT_SEED_PASSWORD);
    expect(await verifyPassword(hash, DEFAULT_SEED_PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, 'wrong_pass')).toBe(false);
  });

  it('supplies at least 30 unique, non-empty questions and normalized keys in the question bank', () => {
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(30);

    const normalizedKeys = new Set<string>();
    for (const q of QUESTION_BANK) {
      expect(q.value.trim().length).toBeGreaterThan(0);
      expect(q.clue.trim().length).toBeGreaterThan(5);

      const norm = q.value.trim().toUpperCase();
      expect(normalizedKeys.has(norm)).toBe(false);
      normalizedKeys.add(norm);
    }
  });

  it('generates valid 3x9 Tombola tickets for all 6 seed players with strict invariants', () => {
    const keys = QUESTION_BANK.map((q, idx) => ({ id: `key-${idx}`, value: q.value }));

    for (let i = 0; i < DEFAULT_ACCOUNTS.players.length; i++) {
      const player = DEFAULT_ACCOUNTS.players[i]!;
      const layout = generateTicketLayout({
        keys,
        seed: `test-seed-${i}-${player.email}`,
      });

      // 15 populated cells
      expect(layout.cells).toHaveLength(15);
      expect(layout.populatedCount).toBe(15);
      expect(layout.emptyCount).toBe(12);

      // Unique keys per ticket
      const ticketKeyIds = layout.cells.map((c) => c.keyId);
      expect(new Set(ticketKeyIds).size).toBe(15);

      // Exactly 5 cells per row
      const rowCounts = [0, 0, 0];
      const colCounts = new Array(9).fill(0);

      for (const cell of layout.cells) {
        expect(cell.rowIndex).toBeGreaterThanOrEqual(0);
        expect(cell.rowIndex).toBeLessThanOrEqual(2);
        expect(cell.colIndex).toBeGreaterThanOrEqual(0);
        expect(cell.colIndex).toBeLessThanOrEqual(8);

        rowCounts[cell.rowIndex]++;
        colCounts[cell.colIndex]++;
      }

      expect(rowCounts).toEqual([5, 5, 5]);

      // At least 1 cell per column
      for (let col = 0; col < 9; col++) {
        expect(colCounts[col]).toBeGreaterThanOrEqual(1);
        expect(colCounts[col]).toBeLessThanOrEqual(3);
      }
    }
  });
});
