import type { UserAccessListItem, UserAccessSummary } from './types';

export type CreateOrApproveUserByEmailInput = {
  readonly email: string;
  readonly name: string | null;
  readonly isApproved: boolean;
  readonly isAdmin: boolean;
};

export interface UserAccessRepository {
  findById(userId: string): Promise<UserAccessSummary | null>;
  findByEmail(email: string): Promise<UserAccessSummary | null>;
  listAll(): Promise<UserAccessListItem[]>;
  createOrApproveByEmail(input: CreateOrApproveUserByEmailInput): Promise<UserAccessSummary>;
  updateApproval(userId: string, isApproved: boolean): Promise<void>;
  updateAdmin(userId: string, isAdmin: boolean): Promise<void>;
}
