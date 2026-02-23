import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';

export async function deleteSpendEntry(
  spendRepo: SpendEntryRepository,
  entryId: string,
): Promise<void> {
  await spendRepo.delete(entryId);
}
