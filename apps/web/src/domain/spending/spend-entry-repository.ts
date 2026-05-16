import type { SpendEntry } from '../trip/types';

export interface SpendEntryRepository {
  findById(id: string): Promise<SpendEntry | null>;
  findByDestination(destinationId: string): Promise<SpendEntry[]>;
  findByTrip(tripId: string): Promise<SpendEntry[]>;
  save(entry: SpendEntry): Promise<SpendEntry>;
  delete(id: string): Promise<void>;
}
