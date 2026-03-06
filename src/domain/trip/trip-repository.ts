import type { Trip } from './types';

export interface TripRepository {
  findById(id: string): Promise<Trip | null>;
  findAllByOrganization(organizationId: string): Promise<Trip[]>;
  save(trip: Trip): Promise<Trip>;
  delete(id: string): Promise<void>;
}
