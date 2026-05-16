export type UserAccessSummary = {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly isApproved: boolean;
  readonly isAdmin: boolean;
  readonly createdAt: Date;
};

export type UserIdpLink = {
  readonly provider: string;
  readonly providerAccountId: string;
};

export type UserOrganizationLink = {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: 'owner' | 'member';
};

export type UserAccessListItem = UserAccessSummary & {
  readonly idps: UserIdpLink[];
  readonly organizations: UserOrganizationLink[];
};
