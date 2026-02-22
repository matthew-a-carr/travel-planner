import type { Trip } from './types';

export interface TripRepository {
  findById(id: string): Promise<Trip | null>;
  findAllByOwner(ownerId: string): Promise<Trip[]>;
  save(trip: Trip): Promise<Trip>;
}
