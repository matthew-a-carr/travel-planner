import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export async function deleteSpendEntry(
  spendRepo: SpendEntryRepository,
  entryId: string,
): Promise<Result<void>> {
  const entry = await spendRepo.findById(entryId);
  if (!entry) return err(`Spend entry not found: ${entryId}`);

  await spendRepo.delete(entryId);
  return ok(undefined);
}
