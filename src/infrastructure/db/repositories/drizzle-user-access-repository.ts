import { asc, eq, sql } from 'drizzle-orm';
import type { UserAccessListItem, UserAccessSummary } from '@/domain/user-access/types';
import type {
  CreateOrApproveUserByEmailInput,
  UserAccessRepository,
} from '@/domain/user-access/user-access-repository';
import { normalizeEmail } from '@/infrastructure/auth/access-policy';
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

function canonicalEmailSql(column: typeof users.email) {
  return sql<string>`
    case
      when lower(trim(${column})) like '%@gmail.com' or lower(trim(${column})) like '%@googlemail.com'
        then replace(split_part(split_part(lower(trim(${column})), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(trim(${column}))
    end
  `;
}

function splitName(name: string | null): { firstName: string | null; lastName: string | null } {
  if (!name) return { firstName: null, lastName: null };

  const parts = name.split(/\s+/);
  const firstName = parts[0] ?? null;
  const remaining = parts.slice(1).join(' ').trim();

  return {
    firstName,
    lastName: remaining.length > 0 ? remaining : null,
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
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`${canonicalEmailSql(users.email)} = ${normalized}`)
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

  async createOrApproveByEmail(input: CreateOrApproveUserByEmailInput): Promise<UserAccessSummary> {
    const normalizedEmail = normalizeEmail(input.email);
    if (!normalizedEmail) throw new Error('Email is required');

    const normalizedName = input.name?.trim() || null;
    const now = new Date();

    const existingRows = await this.db
      .select()
      .from(users)
      .where(sql`${canonicalEmailSql(users.email)} = ${normalizedEmail}`)
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      const nextName = normalizedName ?? existing.name;
      const split = splitName(nextName);
      const updatedRows = await this.db
        .update(users)
        .set({
          email: normalizedEmail,
          name: nextName,
          firstName: split.firstName,
          lastName: split.lastName,
          isApproved: existing.isApproved || input.isApproved,
          isAdmin: existing.isAdmin || input.isAdmin,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id))
        .returning();

      const updated = updatedRows[0];
      if (!updated) throw new Error('Failed to update user access');
      return toSummary(updated);
    }

    const split = splitName(normalizedName);
    const insertedRows = await this.db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: normalizedName,
        firstName: split.firstName,
        lastName: split.lastName,
        isApproved: input.isApproved,
        isAdmin: input.isAdmin,
        emailVerified: null,
        image: null,
      })
      .returning();

    const inserted = insertedRows[0];
    if (!inserted) throw new Error('Failed to create user access');
    return toSummary(inserted);
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
