BEGIN;

ALTER TABLE trips ADD CONSTRAINT check_trip_status
  CHECK (status IN ('planning', 'active', 'completed'));

ALTER TABLE destinations ADD CONSTRAINT check_comfort_level
  CHECK (comfort_level IN ('budget', 'mid', 'luxury'));

ALTER TABLE spend_entries ADD CONSTRAINT check_spend_category
  CHECK (category IN ('accommodation', 'food', 'transport', 'activities', 'shopping', 'other'));

ALTER TABLE trip_fixed_costs ADD CONSTRAINT check_fixed_cost_category
  CHECK (category IN ('accommodation', 'activities', 'bills', 'eating-out', 'fuel',
    'groceries', 'healthcare', 'insurance', 'shopping', 'subscriptions',
    'transport', 'visas', 'other'));

COMMIT;
