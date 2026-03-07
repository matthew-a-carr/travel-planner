import type { UserAccessListItem, UserAccessSummary } from './types';

export type CreateOrApproveUserByEmailInput = {
  readonly email: string;
  readonly name: string | null;
  readonly isApproved: boolean;
  readonly isAdmin: boolean;
};

export type UserApprovalTransition = 'approved_now' | 'already_approved';

export type CreateOrApproveUserByEmailResult = {
  readonly user: UserAccessSummary;
  readonly approvalTransition: UserApprovalTransition;
};

export interface UserAccessRepository {
  findById(userId: string): Promise<UserAccessSummary | null>;
  findByEmail(email: string): Promise<UserAccessSummary | null>;
  listAll(): Promise<UserAccessListItem[]>;
  createOrApproveByEmail(
    input: CreateOrApproveUserByEmailInput,
  ): Promise<CreateOrApproveUserByEmailResult>;
  updateApproval(userId: string, isApproved: boolean): Promise<void>;
  updateAdmin(userId: string, isAdmin: boolean): Promise<void>;
}
