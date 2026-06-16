import { asc, eq } from 'drizzle-orm';
import type { UserProfileRepository } from '@/domain/user-profile/user-profile-repository';
import type { TravellerProfile } from '@/domain/visa/types';
import type { Db } from '../client';
import { userPassports, users } from '../schema';

export class DrizzleUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: Db) {}

  async findByUserId(userId: string): Promise<TravellerProfile> {
    const userRows = await this.db
      .select({ dateOfBirth: users.dateOfBirth })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const passportRows = await this.db
      .select()
      .from(userPassports)
      .where(eq(userPassports.userId, userId))
      .orderBy(asc(userPassports.sortOrder), asc(userPassports.nationality));

    return {
      dateOfBirth: userRows[0]?.dateOfBirth ?? null,
      passports: passportRows.map((row) => ({ nationality: row.nationality, label: row.label })),
    };
  }

  async save(userId: string, profile: TravellerProfile): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ dateOfBirth: profile.dateOfBirth, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx.delete(userPassports).where(eq(userPassports.userId, userId));

      if (profile.passports.length > 0) {
        await tx.insert(userPassports).values(
          profile.passports.map((passport, index) => ({
            userId,
            nationality: passport.nationality,
            label: passport.label,
            sortOrder: index,
          })),
        );
      }
    });
  }
}
