import { redirect } from 'next/navigation';
import { auth } from '@/infrastructure/auth';
import { getActiveOrganizationContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { OrganizationsPanel } from '@/ui/components/OrganizationsPanel';
import { SettingsNav } from '@/ui/components/SettingsNav';

export default async function OrganizationsSettingsPage() {
  const session = await auth();
  const context = await getActiveOrganizationContext();
  if (!context || !session?.user) redirect('/login');

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
        <SettingsNav active="organizations" />
        <OrganizationsPanel
          organizations={context.organizations.map((organization) => ({
            id: organization.organization.id,
            name: organization.organization.name,
            role: organization.role,
          }))}
          activeOrganizationId={context.activeOrganization.organization.id}
        />
      </div>
    </main>
  );
}
