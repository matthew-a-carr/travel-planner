export type OrganizationRole = 'owner' | 'member';

export type Organization = {
  readonly id: string;
  readonly name: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type OrganizationMembership = {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: OrganizationRole;
  readonly createdAt: Date;
};

export type OrganizationWithRole = {
  readonly organization: Organization;
  readonly role: OrganizationRole;
};

export type OrganizationMember = {
  readonly userId: string;
  readonly name: string | null;
  readonly email: string;
  readonly role: OrganizationRole;
  readonly joinedAt: Date;
};

export type OrganizationUser = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
};

export type OrganizationMemberCandidate = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
};
