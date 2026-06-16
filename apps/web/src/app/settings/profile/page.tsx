import { redirect } from 'next/navigation';
import { getTravellerProfile } from '@/application/use-cases/get-traveller-profile';
import { auth } from '@/infrastructure/auth';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { SettingsNav } from '@/ui/components/SettingsNav';
import { TravellerProfileForm } from '@/ui/components/TravellerProfileForm';

export default async function ProfileSettingsPage() {
  const session = await auth();
  const context = await getAuthenticatedAccessContext();
  if (!context || !session?.user) redirect('/login');

  const { userProfileRepository, countryReferenceRepository } = getAppContainer();
  const [profile, countries] = await Promise.all([
    getTravellerProfile(userProfileRepository, context.userId),
    countryReferenceRepository.findAll(),
  ]);

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

      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-8">
        <SettingsNav active="profile" />
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Traveller profile
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your passport(s) and date of birth power visa checks on your trips. This is personal
            information — it's only ever used for your own assessments.
          </p>
        </div>
        <TravellerProfileForm profile={profile} countries={countries} />
      </div>
    </main>
  );
}
