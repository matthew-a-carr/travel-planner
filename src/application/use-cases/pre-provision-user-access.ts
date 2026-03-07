import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessSummary } from '@/domain/user-access/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type PreProvisionUserAccessInput = {
  readonly actorUserId: string;
  readonly email: string;
  readonly name: string | null;
};

function sanitizeOptionalName(name: string | null): string | null {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(email: string): boolean {
  const value = email.trim();
  if (value.length === 0) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function preProvisionUserAccess(
  repository: UserAccessRepository,
  input: PreProvisionUserAccessInput,
): Promise<Result<UserAccessSummary>> {
  if (!isValidEmail(input.email)) return err('Valid email is required');

  const actor = await repository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const user = await repository.createOrApproveByEmail({
    email: input.email,
    name: sanitizeOptionalName(input.name),
    isApproved: true,
    isAdmin: false,
  });

  return ok(user);
}
