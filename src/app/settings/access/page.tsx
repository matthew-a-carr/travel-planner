import { redirect } from 'next/navigation';
import { getUserAccessList } from '@/application/use-cases/get-user-access-list';
import { auth } from '@/infrastructure/auth';
import { isUserAccessAdmin } from '@/infrastructure/auth/access-policy';
import { getAppContainer } from '@/infrastructure/container';
import { db } from '@/infrastructure/db/client';
import { getActiveOrganizationContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { SettingsNav } from '@/ui/components/SettingsNav';
import { UserAccessManagementPanel } from '@/ui/components/UserAccessManagementPanel';

export default async function AccessSettingsPage() {
  const session = await auth();
  const context = await getActiveOrganizationContext();
  if (!context || !session?.user) redirect('/login');

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) redirect('/settings/organizations');

  const { userAccessRepository } = getAppContainer();
  const usersResult = await getUserAccessList(userAccessRepository, context.userId);
  if (!usersResult.ok) redirect('/settings/organizations');

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
        <SettingsNav active="access" />
        <UserAccessManagementPanel users={usersResult.value} currentUserId={context.userId} />
      </div>
    </main>
  );
}
