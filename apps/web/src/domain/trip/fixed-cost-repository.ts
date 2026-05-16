import type { TripFixedCost } from './types';

export interface TripFixedCostRepository {
  findById(id: string): Promise<TripFixedCost | null>;
  findByTrip(tripId: string): Promise<TripFixedCost[]>;
  save(fixedCost: TripFixedCost): Promise<TripFixedCost>;
  delete(id: string): Promise<void>;
}
