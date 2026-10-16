import { count, eq, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '../../db/client.ts';
import { adminProfiles } from '../../db/schema/users.ts';
import { getEnv } from '../../config/env.ts';
import { ConflictError, UnauthorizedError } from '../../shared/errors/app-error.ts';
import { auditService } from '../audit/audit.service.ts';
import { hashPassword } from './auth.domain.ts';
import { userRepository } from './user.repository.ts';
import type { BootstrapSuperAdminInput } from './bootstrap.schemas.ts';

function secretMatches(configuredSecret: string | undefined, suppliedSecret: string): boolean {
  if (!configuredSecret) return false;
  const configured = Buffer.from(configuredSecret);
  const supplied = Buffer.from(suppliedSecret);
  return configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

export async function bootstrapSuperAdmin(
  input: BootstrapSuperAdminInput,
  suppliedSecret: string,
  context?: { ip?: string; userAgent?: string; requestId?: string }
) {
  const env = getEnv();
  if (!secretMatches(env.SUPER_ADMIN_BOOTSTRAP_SECRET, suppliedSecret)) {
    throw new UnauthorizedError('Bootstrap is not available');
  }

  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const db = getDb();

  return db.transaction(async (tx) => {
    // Serialize bootstrap attempts so only one request can create the initial account.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('tech-tombola-super-admin-bootstrap'))`);
    const [existingAdmin] = await tx
      .select({ count: count() })
      .from(adminProfiles)
      .where(eq(adminProfiles.role, 'SUPER_ADMIN'));
    if (Number(existingAdmin?.count ?? 0) > 0) {
      throw new ConflictError('Super Admin bootstrap has already been completed');
    }

    if (await userRepository.findByEmail(email, tx)) {
      throw new ConflictError(`An account with email '${email}' already exists`);
    }

    const created = await userRepository.create(
      { email, name: input.name.trim(), passwordHash, status: 'ACTIVE' },
      { role: 'SUPER_ADMIN' },
      tx
    );
    await auditService.record(
      {
        actorId: created.id,
        actorType: 'SUPER_ADMIN',
        action: 'SUPER_ADMIN_BOOTSTRAPPED',
        resourceType: 'admin_account',
        resourceId: created.id,
        metadata: { email },
        ip: context?.ip,
        userAgent: context?.userAgent,
        requestId: context?.requestId,
      },
      tx
    );

    return { id: created.id, email: created.email, name: created.name, role: created.adminProfile?.role };
  });
}
