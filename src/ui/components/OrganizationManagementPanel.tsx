'use client';

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  type AddOrganizationMemberState,
  addOrganizationMemberAction,
  type CreateOrganizationState,
  createOrganizationAction,
  type OrganizationMemberCandidateState,
  removeOrganizationMemberAction,
  searchOrganizationMemberCandidatesAction,
} from '@/app/organizations/actions';

type OrganizationMemberView = {
  readonly userId: string;
  readonly name: string | null;
  readonly email: string;
  readonly role: 'owner' | 'member';
};

const INITIAL_CREATE_STATE: CreateOrganizationState = { error: null };
const INITIAL_ADD_MEMBER_STATE: AddOrganizationMemberState = { error: null };
const SEARCH_DEBOUNCE_MS = 200;

function describeCandidate(candidate: OrganizationMemberCandidateState): string {
  const trimmedName = candidate.name?.trim() ?? '';
  return trimmedName.length > 0 ? `${trimmedName} (${candidate.email})` : candidate.email;
}

export function OrganizationManagementPanel({
  activeOrganizationId,
  activeOrganizationName,
  activeOrganizationRole,
  currentUserId,
  members,
}: {
  activeOrganizationId: string;
  activeOrganizationName: string;
  activeOrganizationRole: 'owner' | 'member';
  currentUserId: string;
  members: OrganizationMemberView[];
}) {
  const [createState, createDispatch, isCreating] = useActionState(
    createOrganizationAction,
    INITIAL_CREATE_STATE,
  );
  const [addMemberState, addMemberDispatch, isAddingMember] = useActionState(
    addOrganizationMemberAction,
    INITIAL_ADD_MEMBER_STATE,
  );
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] =
    useState<OrganizationMemberCandidateState | null>(null);
  const [isCandidateListOpen, setIsCandidateListOpen] = useState(false);
  const [candidateResults, setCandidateResults] = useState<
    readonly OrganizationMemberCandidateState[]
  >([]);
  const [isSearchingCandidates, startSearchCandidates] = useTransition();
  const latestSearchRequestRef = useRef(0);

  const canManageMembers = activeOrganizationRole === 'owner';

  const loadCandidateResults = useCallback(
    (query: string): void => {
      const requestId = latestSearchRequestRef.current + 1;
      latestSearchRequestRef.current = requestId;

      startSearchCandidates(async () => {
        const results = await searchOrganizationMemberCandidatesAction({
          organizationId: activeOrganizationId,
          query,
        });
        if (latestSearchRequestRef.current !== requestId) return;
        setCandidateResults(results);
      });
    },
    [activeOrganizationId],
  );

  useEffect(() => {
    if (!canManageMembers || !isCandidateListOpen) return;
    const timeout = window.setTimeout(() => {
      loadCandidateResults(memberSearchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [canManageMembers, isCandidateListOpen, loadCandidateResults, memberSearchQuery]);

  const addSubmitDisabled = isAddingMember || selectedCandidate === null;

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Organization settings
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Managing <span className="font-medium">{activeOrganizationName}</span> (
          {activeOrganizationRole})
        </p>
      </div>

      {canManageMembers ? (
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
      ) : (
        <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          Only organization owners can create organizations and manage members.
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Members</h3>
        <ul className="space-y-1">
          {members.map((member) => {
            const canRemove =
              canManageMembers && member.role !== 'owner' && member.userId !== currentUserId;
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
            <input type="hidden" name="targetUserId" value={selectedCandidate?.id ?? ''} />
            <label
              htmlFor="member-search"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
            >
              Search users to add
            </label>
            <div className="relative space-y-2">
              <input
                id="member-search"
                name="memberSearch"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isCandidateListOpen}
                aria-controls="member-search-results"
                autoComplete="off"
                placeholder="Search by name or email"
                value={memberSearchQuery}
                onFocus={() => {
                  setIsCandidateListOpen(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    setIsCandidateListOpen(false);
                  }, 120);
                }}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setMemberSearchQuery(nextQuery);
                  setSelectedCandidate(null);
                }}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              {isCandidateListOpen && (
                <div
                  id="member-search-results"
                  role="listbox"
                  className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {isSearchingCandidates ? (
                    <p className="px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
                  ) : candidateResults.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400">
                      No matching signed-up users.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {candidateResults.map((candidate) => (
                        <li key={candidate.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedCandidate?.id === candidate.id}
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setMemberSearchQuery(candidate.email);
                              setIsCandidateListOpen(false);
                            }}
                            className="block w-full rounded-md px-2 py-1 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            {describeCandidate(candidate)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={addSubmitDisabled}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isAddingMember ? 'Adding…' : 'Add'}
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {selectedCandidate
                  ? `Selected: ${describeCandidate(selectedCandidate)}`
                  : 'Select a signed-up user before adding.'}
              </p>
            </div>
            {addMemberState.error && <p className="text-sm text-red-600">{addMemberState.error}</p>}
          </form>
        ) : (
          <p className="border-t border-zinc-200 pt-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
            You can view members, but only organization owners can change membership.
          </p>
        )}
      </div>
    </section>
  );
}
