import { redirect } from 'next/navigation';
import { getOrganizationMembers } from '@/application/use-cases/get-organization-members';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { getActiveOrganizationContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { OrganizationManagementPanel } from '@/ui/components/OrganizationManagementPanel';

export default async function OrganizationSettingsPage() {
  const session = await auth();
  const context = await getActiveOrganizationContext();
  if (!context || !session?.user) redirect('/login');

  const organizationRepository = new DrizzleOrganizationRepository(db);
  const membersResult = await getOrganizationMembers(
    organizationRepository,
    context.activeOrganization.organization.id,
    context.userId,
  );
  const members = membersResult.ok ? membersResult.value.members : [];

  return (
    <main className="min-h-screen">
      <AuthenticatedAppHeader
        activeNav="settings"
        organizations={context.organizations.map((organization) => ({
          id: organization.organization.id,
          name: organization.organization.name,
          role: organization.role,
        }))}
        activeOrganizationId={context.activeOrganization.organization.id}
        userImage={session.user.image}
        userName={session.user.name}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8">
        <OrganizationManagementPanel
          activeOrganizationId={context.activeOrganization.organization.id}
          activeOrganizationName={context.activeOrganization.organization.name}
          activeOrganizationRole={context.activeOrganization.role}
          currentUserId={context.userId}
          members={members}
        />
      </div>
    </main>
  );
}
