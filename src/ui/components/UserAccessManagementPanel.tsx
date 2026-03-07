'use client';

import { useActionState } from 'react';
import {
  deleteUserAction,
  preProvisionUserAction,
  resendUserInviteAction,
  type UpdateUserAccessState,
  updateUserAdminAction,
  updateUserApprovalAction,
} from '@/app/settings/access/actions';
import type { UserAccessListItem } from '@/domain/user-access/types';

function describeName(user: UserAccessListItem): string {
  const first = user.firstName?.trim() ?? '';
  const last = user.lastName?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full.length > 0) return full;
  if (user.name?.trim()) return user.name.trim();
  return user.email;
}

function formatIdps(user: UserAccessListItem): string {
  if (user.idps.length === 0) return 'none';
  return user.idps.map((idp) => `${idp.provider} (${idp.providerAccountId})`).join(', ');
}

function formatOrganizations(user: UserAccessListItem): string {
  if (user.organizations.length === 0) return 'none';
  return user.organizations.map((org) => `${org.organizationName} (${org.role})`).join(', ');
}

export function UserAccessManagementPanel({
  users,
  currentUserId,
}: {
  users: readonly UserAccessListItem[];
  currentUserId: string;
}) {
  const initialState: UpdateUserAccessState = { error: null, warning: null, notice: null };
  const [approvalState, approvalDispatch, isSavingApproval] = useActionState(
    updateUserApprovalAction,
    initialState,
  );
  const [adminState, adminDispatch, isSavingAdmin] = useActionState(
    updateUserAdminAction,
    initialState,
  );
  const [preProvisionState, preProvisionDispatch, isPreProvisioning] = useActionState(
    preProvisionUserAction,
    initialState,
  );
  const [resendInviteState, resendInviteDispatch, isResendingInvite] = useActionState(
    resendUserInviteAction,
    initialState,
  );
  const [deleteState, deleteDispatch, isDeleting] = useActionState(deleteUserAction, initialState);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Application access
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Manage who can sign in and who can administer access.
        </p>
      </div>

      <form
        action={preProvisionDispatch}
        className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Pre-provision user
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Create or approve a user before they sign in. Organization assignment is managed
          separately.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@example.com"
            className="block min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <input
            name="name"
            type="text"
            placeholder="Optional display name"
            className="block min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={isPreProvisioning}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPreProvisioning ? 'Saving…' : 'Pre-provision'}
          </button>
        </div>
        {preProvisionState.error && (
          <p className="text-sm text-red-600">{preProvisionState.error}</p>
        )}
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
          <thead>
            <tr className="text-left text-zinc-600 dark:text-zinc-300">
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Email</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Linked IdPs</th>
              <th className="px-2 py-2 font-medium">Organizations</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const nextApproval = user.isApproved ? 'false' : 'true';
              const nextAdmin = user.isAdmin ? 'false' : 'true';

              return (
                <tr key={user.id} className="align-top text-zinc-700 dark:text-zinc-200">
                  <td className="px-2 py-3">{describeName(user)}</td>
                  <td className="px-2 py-3">{user.email}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          user.isApproved
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}
                      >
                        {user.isApproved ? 'approved' : 'blocked'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          user.isAdmin
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {user.isAdmin ? 'admin' : 'user'}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">{formatIdps(user)}</td>
                  <td className="px-2 py-3">{formatOrganizations(user)}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={approvalDispatch}>
                        <input type="hidden" name="targetUserId" value={user.id} />
                        <input type="hidden" name="nextValue" value={nextApproval} />
                        <button
                          type="submit"
                          disabled={isSavingApproval || isSelf}
                          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {user.isApproved ? 'Revoke access' : 'Approve access'}
                        </button>
                      </form>

                      {user.isApproved && (
                        <form action={resendInviteDispatch}>
                          <input type="hidden" name="targetUserId" value={user.id} />
                          <button
                            type="submit"
                            disabled={isResendingInvite}
                            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Resend invite
                          </button>
                        </form>
                      )}

                      <form action={adminDispatch}>
                        <input type="hidden" name="targetUserId" value={user.id} />
                        <input type="hidden" name="nextValue" value={nextAdmin} />
                        <button
                          type="submit"
                          disabled={isSavingAdmin || isSelf}
                          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {user.isAdmin ? 'Remove admin' : 'Make admin'}
                        </button>
                      </form>

                      {!isSelf && (
                        <form
                          action={deleteDispatch}
                          onSubmit={(e) => {
                            if (!confirm(`Delete ${describeName(user)}? This cannot be undone.`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="targetUserId" value={user.id} />
                          <button
                            type="submit"
                            disabled={
                              isDeleting ||
                              isSavingApproval ||
                              isSavingAdmin ||
                              isPreProvisioning ||
                              isResendingInvite
                            }
                            className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            {isDeleting ? 'Deleting...' : 'Delete user'}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {approvalState.error && <p className="text-sm text-red-600">{approvalState.error}</p>}
      {adminState.error && <p className="text-sm text-red-600">{adminState.error}</p>}
      {resendInviteState.error && <p className="text-sm text-red-600">{resendInviteState.error}</p>}
      {deleteState.error && <p className="text-sm text-red-600">{deleteState.error}</p>}
      {preProvisionState.warning && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{preProvisionState.warning}</p>
      )}
      {resendInviteState.warning && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{resendInviteState.warning}</p>
      )}
      {preProvisionState.notice && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{preProvisionState.notice}</p>
      )}
      {resendInviteState.notice && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{resendInviteState.notice}</p>
      )}
      {(isSavingApproval ||
        isSavingAdmin ||
        isPreProvisioning ||
        isResendingInvite ||
        isDeleting) && <p className="text-sm text-zinc-500 dark:text-zinc-400">Saving changes…</p>}
    </section>
  );
}
