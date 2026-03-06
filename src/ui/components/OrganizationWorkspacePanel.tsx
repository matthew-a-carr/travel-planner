'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  type AddOrganizationMemberState,
  addOrganizationMemberAction,
  type CreateOrganizationState,
  createOrganizationAction,
  removeOrganizationMemberAction,
  setActiveOrganizationAction,
} from '@/app/organizations/actions';

type OrganizationOption = {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
};

type OrganizationMemberView = {
  readonly userId: string;
  readonly name: string | null;
  readonly email: string;
  readonly role: 'owner' | 'member';
};

const INITIAL_CREATE_STATE: CreateOrganizationState = { error: null };
const INITIAL_ADD_MEMBER_STATE: AddOrganizationMemberState = { error: null };

export function OrganizationWorkspacePanel({
  organizations,
  activeOrganizationId,
  currentUserId,
  members,
}: {
  organizations: OrganizationOption[];
  activeOrganizationId: string;
  currentUserId: string;
  members: OrganizationMemberView[];
}) {
  const [isSwitching, startSwitching] = useTransition();
  const [createState, createDispatch, isCreating] = useActionState(
    createOrganizationAction,
    INITIAL_CREATE_STATE,
  );
  const [addMemberState, addMemberDispatch, isAddingMember] = useActionState(
    addOrganizationMemberAction,
    INITIAL_ADD_MEMBER_STATE,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const router = useRouter();

  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const canManageMembers = activeOrganization?.role === 'owner';

  useEffect(() => {
    if (createState.error || addMemberState.error) {
      setIsPanelOpen(true);
      setIsManaging(true);
    }
  }, [createState.error, addMemberState.error]);

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setIsPanelOpen((value) => !value)}
        aria-expanded={isPanelOpen}
        aria-label={isPanelOpen ? 'Close organization menu' : 'Open organization menu'}
        className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Organization
          </span>
          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {activeOrganization?.name ?? 'Unknown workspace'}
          </span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            {activeOrganization?.role ?? 'member'} access
          </span>
        </span>
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {isPanelOpen ? 'Hide' : 'Open'}
        </span>
      </button>

      {isPanelOpen && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <label
                htmlFor="active-organization"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Active organization
              </label>
              <select
                id="active-organization"
                name="organizationId"
                value={activeOrganizationId}
                disabled={isSwitching}
                onChange={(event) => {
                  const selectedOrganizationId = event.target.value;
                  startSwitching(async () => {
                    await setActiveOrganizationAction(selectedOrganizationId);
                    router.refresh();
                  });
                }}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} ({organization.role})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setIsManaging((value) => !value)}
              aria-expanded={isManaging}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {isManaging ? 'Hide management' : 'Manage organization'}
            </button>
          </div>

          {isManaging && (
            <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <form
                action={createDispatch}
                className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <label
                  htmlFor="organization-name"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Create organization
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="organization-name"
                    name="name"
                    type="text"
                    required
                    placeholder="Summer Planning Team"
                    className="block min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {isCreating ? 'Creating…' : 'Create'}
                  </button>
                </div>
                {createState.error && <p className="text-sm text-red-600">{createState.error}</p>}
              </form>

              <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Members</h3>
                <ul className="space-y-1">
                  {members.map((member) => {
                    const canRemove =
                      canManageMembers &&
                      member.role !== 'owner' &&
                      member.userId !== currentUserId;
                    const removeAction = removeOrganizationMemberAction.bind(
                      null,
                      activeOrganizationId,
                      member.userId,
                    );

                    return (
                      <li
                        key={member.userId}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-zinc-700 dark:text-zinc-200">
                          {member.name ?? member.email} ({member.role})
                        </span>
                        {canRemove && (
                          <form action={removeAction}>
                            <button
                              type="submit"
                              className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              Remove
                            </button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {canManageMembers ? (
                  <form
                    action={addMemberDispatch}
                    className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700"
                  >
                    <input type="hidden" name="organizationId" value={activeOrganizationId} />
                    <label
                      htmlFor="member-email"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                    >
                      Add member by email
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="member-email"
                        name="email"
                        type="email"
                        required
                        placeholder="partner@example.com"
                        className="block min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={isAddingMember}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        {isAddingMember ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                    {addMemberState.error && (
                      <p className="text-sm text-red-600">{addMemberState.error}</p>
                    )}
                  </form>
                ) : (
                  <p className="border-t border-zinc-200 pt-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
                    Only organization owners can manage members.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
