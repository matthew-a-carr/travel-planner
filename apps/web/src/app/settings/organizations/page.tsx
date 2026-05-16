import { redirect } from 'next/navigation';
import { auth } from '@/infrastructure/auth';
import { isUserAccessAdmin } from '@/infrastructure/auth/access-policy';
import { db } from '@/infrastructure/db/client';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { OrganizationsPanel } from '@/ui/components/OrganizationsPanel';
import { SettingsNav } from '@/ui/components/SettingsNav';

export default async function OrganizationsSettingsPage() {
  const session = await auth();
  const context = await getAuthenticatedAccessContext();
  if (!context || !session?.user) redirect('/login');
  const isAdmin = await isUserAccessAdmin(db, context.userId);

  return (
    <main className="min-h-screen">
      <AuthenticatedAppHeader
        activeNav="settings"
        organizations={context.organizations.map((organization) => ({
          id: organization.organization.id,
          name: organization.organization.name,
          role: organization.role,
        }))}
        activeOrganizationId={context.activeOrganization?.organization.id ?? null}
        userImage={session.user.image}
        userName={session.user.name}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8">
        <SettingsNav active="organizations" />
        <OrganizationsPanel
          organizations={context.organizations.map((organization) => ({
            id: organization.organization.id,
            name: organization.organization.name,
            role: organization.role,
          }))}
          activeOrganizationId={context.activeOrganization?.organization.id ?? null}
          canCreateOrganization={isAdmin}
        />
      </div>
    </main>
  );
}
