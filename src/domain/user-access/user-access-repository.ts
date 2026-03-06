import type { UserAccessListItem, UserAccessSummary } from './types';

export interface UserAccessRepository {
  findById(userId: string): Promise<UserAccessSummary | null>;
  findByEmail(email: string): Promise<UserAccessSummary | null>;
  listAll(): Promise<UserAccessListItem[]>;
  updateApproval(userId: string, isApproved: boolean): Promise<void>;
  updateAdmin(userId: string, isAdmin: boolean): Promise<void>;
}
