BEGIN;

CREATE INDEX idx_trips_organization_id ON trips (organization_id);
CREATE INDEX idx_destinations_trip_id ON destinations (trip_id);
CREATE INDEX idx_spend_entries_destination_id ON spend_entries (destination_id);
CREATE INDEX idx_trip_fixed_costs_trip_id ON trip_fixed_costs (trip_id);

COMMIT;
