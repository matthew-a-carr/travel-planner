'use client';

import { useActionState } from 'react';
import {
  type CreateOrganizationState,
  createOrganizationAction,
} from '@/app/settings/organizations/actions';

type OrganizationListItem = {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
};

const INITIAL_CREATE_STATE: CreateOrganizationState = { error: null };

export function OrganizationsPanel({
  organizations,
  activeOrganizationId,
}: {
  organizations: readonly OrganizationListItem[];
  activeOrganizationId: string;
}) {
  const [createState, createDispatch, isCreating] = useActionState(
    createOrganizationAction,
    INITIAL_CREATE_STATE,
  );

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Organizations</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Create a new organization or review organizations you belong to.
        </p>
      </div>

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
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Your organizations
        </h3>
        <ul className="space-y-1">
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganizationId;
            return (
              <li
                key={organization.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-zinc-700 dark:text-zinc-200">
                  {organization.name} ({organization.role})
                </span>
                {isActive && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Active
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
