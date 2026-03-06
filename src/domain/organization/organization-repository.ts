import type {
  Organization,
  OrganizationMember,
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

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null>;
  findOrganizationsForUser(userId: string): Promise<OrganizationWithRole[]>;
  listMembers(organizationId: string): Promise<OrganizationMember[]>;
  findUserByEmail(email: string): Promise<OrganizationUser | null>;
  createOrganizationWithOwner(input: CreateOrganizationWithOwnerInput): Promise<Organization>;
  addMember(input: AddOrganizationMemberInput): Promise<OrganizationMembership>;
  removeMember(organizationId: string, userId: string): Promise<void>;
}
