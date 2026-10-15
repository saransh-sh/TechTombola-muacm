import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import {
  users,
  adminProfiles,
  type UserRecord,
  type InsertUser,
  type AdminProfileRecord,
} from '../../db/schema/users.ts';

export interface UserWithProfile extends UserRecord {
  adminProfile: AdminProfileRecord | null;
}

export interface IUserRepository {
  findByEmail(email: string, tx?: any): Promise<UserWithProfile | null>;
  findById(id: string, tx?: any): Promise<UserWithProfile | null>;
  create(
    userData: InsertUser,
    adminData?: { role: string },
    tx?: any
  ): Promise<UserWithProfile>;
}

export class UserRepository implements IUserRepository {
  private getClient(tx?: any) {
    return tx || getDb();
  }

  async findByEmail(email: string, tx?: any): Promise<UserWithProfile | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select({
        user: users,
        adminProfile: adminProfiles,
      })
      .from(users)
      .leftJoin(adminProfiles, eq(adminProfiles.userId, users.id))
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    if (rows.length === 0) return null;
    const { user, adminProfile } = rows[0];
    return { ...user, adminProfile };
  }

  async findById(id: string, tx?: any): Promise<UserWithProfile | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select({
        user: users,
        adminProfile: adminProfiles,
      })
      .from(users)
      .leftJoin(adminProfiles, eq(adminProfiles.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    const { user, adminProfile } = rows[0];
    return { ...user, adminProfile };
  }

  async create(
    userData: InsertUser,
    adminData?: { role: string },
    tx?: any
  ): Promise<UserWithProfile> {
    const client = this.getClient(tx);

    const [user] = await client
      .insert(users)
      .values({
        ...userData,
        email: userData.email.trim().toLowerCase(),
      })
      .returning();

    let adminProfile: AdminProfileRecord | null = null;
    if (adminData) {
      const [profile] = await client
        .insert(adminProfiles)
        .values({
          userId: user.id,
          role: adminData.role,
        })
        .returning();
      adminProfile = profile;
    }

    return { ...user, adminProfile };
  }
}

export const userRepository = new UserRepository();
