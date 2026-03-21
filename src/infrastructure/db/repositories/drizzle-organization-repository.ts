import { and, asc, eq, like, not, sql } from 'drizzle-orm';
import type {
  AddOrganizationMemberInput,
  CreateOrganizationWithOwnerInput,
  OrganizationRepository,
  SearchMemberCandidatesInput,
} from '@/domain/organization/organization-repository';
import type {
  Organization,
  OrganizationMember,
  OrganizationMemberCandidate,
  OrganizationMembership,
  OrganizationRole,
  OrganizationUser,
  OrganizationWithRole,
} from '@/domain/organization/types';
import { normalizeEmail } from '@/infrastructure/auth/access-policy';
import { canonicalEmailSql } from '../canonical-email-sql';
import type { Db } from '../client';
import { organizationMemberships, organizations, users } from '../schema';

function toOrganization(row: typeof organizations.$inferSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMembership(row: typeof organizationMemberships.$inferSelect): OrganizationMembership {
  return {
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role as OrganizationRole,
    createdAt: row.createdAt,
  };
}

export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Organization | null> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return rows[0] ? toOrganization(rows[0]) : null;
  }

  async findMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMembership | null> {
    const rows = await this.db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ? toMembership(rows[0]) : null;
  }

  async findOrganizationsForUser(userId: string): Promise<OrganizationWithRole[]> {
    const rows = await this.db
      .select({
        organization: organizations,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(eq(organizationMemberships.userId, userId))
      .orderBy(asc(organizations.createdAt), asc(organizations.name));

    return rows.map((row) => ({
      organization: toOrganization(row.organization),
      role: row.role as OrganizationRole,
    }));
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await this.db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, organizationId))
      .orderBy(asc(organizationMemberships.createdAt), asc(users.email));

    return rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role as OrganizationRole,
      joinedAt: row.joinedAt,
    }));
  }

  async findUserById(userId: string): Promise<OrganizationUser | null> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
    };
  }

  async findUserByEmail(email: string): Promise<OrganizationUser | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(sql`${canonicalEmailSql(users.email)} = ${normalized}`)
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
    };
  }

  async searchMemberCandidates(
    input: SearchMemberCandidatesInput,
  ): Promise<OrganizationMemberCandidate[]> {
    const normalizedQuery = input.query.trim().toLowerCase();
    const containsPattern = `%${normalizedQuery}%`;

    const filters = [
      sql`not exists (
        select 1
        from ${organizationMemberships}
        where ${organizationMemberships.organizationId} = ${input.organizationId}
          and ${organizationMemberships.userId} = ${users.id}
      )`,
      not(like(users.email, 'deleted-%@anonymized.local')),
    ];

    if (normalizedQuery.length > 0) {
      filters.push(
        sql`(
          lower(${users.email}) like ${containsPattern}
          or lower(coalesce(${users.name}, '')) like ${containsPattern}
        )`,
      );
    }

    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(and(...filters))
      .orderBy(
        sql`lower(coalesce(${users.name}, ${users.email}))`,
        sql`lower(${users.email})`,
        asc(users.id),
      )
      .limit(input.limit);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
    }));
  }

  async createOrganizationWithOwner(
    input: CreateOrganizationWithOwnerInput,
  ): Promise<Organization> {
    return this.db.transaction(async (tx) => {
      const insertedOrganizations = await tx
        .insert(organizations)
        .values({
          id: input.organizationId,
          name: input.name,
          createdByUserId: input.ownerUserId,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        })
        .returning();

      const organization = insertedOrganizations[0];
      if (!organization) throw new Error('Failed to create organization');

      await tx.insert(organizationMemberships).values({
        organizationId: organization.id,
        userId: input.ownerUserId,
        role: 'owner',
        createdAt: input.createdAt,
      });

      return toOrganization(organization);
    });
  }

  async addMember(input: AddOrganizationMemberInput): Promise<OrganizationMembership> {
    const rows = await this.db
      .insert(organizationMemberships)
      .values({
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        createdAt: input.createdAt,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error('Failed to add organization member');
    return toMembership(row);
  }

  async removeMember(organizationId: string, userId: string): Promise<void> {
    await this.db
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
        ),
      );
  }
}
