import { asc, eq, sql } from 'drizzle-orm';
import type { UserAccessListItem, UserAccessSummary } from '@/domain/user-access/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';
import type { Db } from '../client';
import { accounts, organizationMemberships, organizations, users } from '../schema';

function toSummary(row: typeof users.$inferSelect): UserAccessSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    isApproved: row.isApproved,
    isAdmin: row.isAdmin,
    createdAt: row.createdAt,
  };
}

export class DrizzleUserAccessRepository implements UserAccessRepository {
  constructor(private readonly db: Db) {}

  async findById(userId: string): Promise<UserAccessSummary | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const row = rows[0];
    return row ? toSummary(row) : null;
  }

  async findByEmail(email: string): Promise<UserAccessSummary | null> {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    const row = rows[0];
    return row ? toSummary(row) : null;
  }

  async listAll(): Promise<UserAccessListItem[]> {
    const userRows = await this.db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.email));

    const accountRows = await this.db
      .select({
        userId: accounts.userId,
        provider: accounts.provider,
        providerAccountId: accounts.providerAccountId,
      })
      .from(accounts)
      .orderBy(asc(accounts.provider), asc(accounts.providerAccountId));

    const organizationRows = await this.db
      .select({
        userId: organizationMemberships.userId,
        organizationId: organizations.id,
        organizationName: organizations.name,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .orderBy(asc(organizations.createdAt), asc(organizations.name));

    const accountsByUser = new Map<string, { provider: string; providerAccountId: string }[]>();
    for (const account of accountRows) {
      const existing = accountsByUser.get(account.userId) ?? [];
      existing.push({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });
      accountsByUser.set(account.userId, existing);
    }

    const organizationsByUser = new Map<
      string,
      { organizationId: string; organizationName: string; role: 'owner' | 'member' }[]
    >();
    for (const organizationRow of organizationRows) {
      const existing = organizationsByUser.get(organizationRow.userId) ?? [];
      existing.push({
        organizationId: organizationRow.organizationId,
        organizationName: organizationRow.organizationName,
        role: organizationRow.role as 'owner' | 'member',
      });
      organizationsByUser.set(organizationRow.userId, existing);
    }

    return userRows.map((userRow) => ({
      ...toSummary(userRow),
      idps: accountsByUser.get(userRow.id) ?? [],
      organizations: organizationsByUser.get(userRow.id) ?? [],
    }));
  }

  async updateApproval(userId: string, isApproved: boolean): Promise<void> {
    await this.db
      .update(users)
      .set({
        isApproved,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateAdmin(userId: string, isAdmin: boolean): Promise<void> {
    await this.db
      .update(users)
      .set({
        isAdmin,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}
