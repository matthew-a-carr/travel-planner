import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';

export async function removeFixedCost(
  fixedCostRepo: TripFixedCostRepository,
  fixedCostId: string,
): Promise<void> {
  await fixedCostRepo.delete(fixedCostId);
}
