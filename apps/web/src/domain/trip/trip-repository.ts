import type { Trip, TripIntent } from './types';

export interface TripRepository {
  findById(id: string): Promise<Trip | null>;
  findAllByOrganization(organizationId: string): Promise<Trip[]>;
  save(trip: Trip): Promise<Trip>;
  delete(id: string): Promise<void>;

  /** The trip's visa intent, or null if the trip does not exist (SPEC-018). */
  getIntent(id: string): Promise<TripIntent | null>;
  /** Persist the trip's visa intent. */
  setIntent(id: string, intent: TripIntent): Promise<void>;
}
