import type {
  Organization,
  OrganizationMember,
  OrganizationMemberCandidate,
  OrganizationMembership,
  OrganizationRole,
  OrganizationUser,
  OrganizationWithRole,
} from './types';

export type CreateOrganizationWithOwnerInput = {
  readonly organizationId: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type AddOrganizationMemberInput = {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: OrganizationRole;
  readonly createdAt: Date;
};

export type SearchMemberCandidatesInput = {
  readonly organizationId: string;
  readonly query: string;
  readonly limit: number;
};

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null>;
  findOrganizationsForUser(userId: string): Promise<OrganizationWithRole[]>;
  listMembers(organizationId: string): Promise<OrganizationMember[]>;
  findUserById(userId: string): Promise<OrganizationUser | null>;
  findUserByEmail(email: string): Promise<OrganizationUser | null>;
  searchMemberCandidates(
    input: SearchMemberCandidatesInput,
  ): Promise<OrganizationMemberCandidate[]>;
  createOrganizationWithOwner(input: CreateOrganizationWithOwnerInput): Promise<Organization>;
  addMember(input: AddOrganizationMemberInput): Promise<OrganizationMembership>;
  removeMember(organizationId: string, userId: string): Promise<void>;
}
