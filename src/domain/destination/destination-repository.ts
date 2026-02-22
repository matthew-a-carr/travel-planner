import type { Destination } from '../trip/types';

export interface DestinationRepository {
  findById(id: string): Promise<Destination | null>;
  findByTrip(tripId: string): Promise<Destination[]>;
  save(destination: Destination): Promise<Destination>;
  delete(id: string): Promise<void>;
}
