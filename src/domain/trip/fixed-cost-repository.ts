import type { TripFixedCost } from './types';

export interface TripFixedCostRepository {
  findByTrip(tripId: string): Promise<TripFixedCost[]>;
  save(fixedCost: TripFixedCost): Promise<TripFixedCost>;
  delete(id: string): Promise<void>;
}
