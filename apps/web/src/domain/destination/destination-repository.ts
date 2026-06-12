import type { Destination } from '../trip/types';

export interface DestinationRepository {
  findById(id: string): Promise<Destination | null>;
  findByTrip(tripId: string): Promise<Destination[]>;
  /** Batch read across trips (single query) — avoids N+1 when listing trips. */
  findByTrips(tripIds: string[]): Promise<Destination[]>;
  save(destination: Destination): Promise<Destination>;
  delete(id: string): Promise<void>;
}
