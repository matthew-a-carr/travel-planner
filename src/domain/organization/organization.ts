import type { OrganizationRole } from './types';

const LOCAL_DEV_USER_EMAIL = 'local-dev@travel-planner.local';
const LOCAL_DEV_WORKSPACE_NAME = 'Local Dev Workspace';
const PERSONAL_WORKSPACE_SUFFIX = "'s Workspace";
const MAX_ORGANIZATION_NAME_LENGTH = 80;

type PersonalOrganizationNameInput = {
  readonly userName: string | null;
  readonly email: string | null;
};

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function trimToLength(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trimEnd();
}

export function derivePersonalOrganizationName(input: PersonalOrganizationNameInput): string {
  const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
  if (normalizedEmail === LOCAL_DEV_USER_EMAIL) return LOCAL_DEV_WORKSPACE_NAME;

  const userName = input.userName ? collapseWhitespace(input.userName) : '';
  if (userName.length > 0) {
    return trimToLength(`${userName}${PERSONAL_WORKSPACE_SUFFIX}`, MAX_ORGANIZATION_NAME_LENGTH);
  }

  const emailLocalPart = normalizedEmail ? (normalizedEmail.split('@')[0] ?? '') : '';
  const fallbackStem = collapseWhitespace(emailLocalPart || 'My');
  return trimToLength(`${fallbackStem}${PERSONAL_WORKSPACE_SUFFIX}`, MAX_ORGANIZATION_NAME_LENGTH);
}

export function canManageOrganizationMembers(role: OrganizationRole): boolean {
  return role === 'owner';
}

export function canMoveTripsBetweenOrganizations(role: OrganizationRole): boolean {
  return role === 'owner';
}
