import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export async function removeFixedCost(
  fixedCostRepo: TripFixedCostRepository,
  fixedCostId: string,
): Promise<Result<void>> {
  const fixedCost = await fixedCostRepo.findById(fixedCostId);
  if (!fixedCost) return err(`Fixed cost not found: ${fixedCostId}`);

  await fixedCostRepo.delete(fixedCostId);
  return ok(undefined);
}
