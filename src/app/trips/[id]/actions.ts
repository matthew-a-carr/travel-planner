'use server';

export {
  type AddDestinationState,
  addDestinationAction,
  type EditDestinationState,
  editDestinationAction,
  removeDestinationAction,
} from './destination-actions';
export {
  addFixedCostAction,
  type EditFixedCostState,
  editFixedCostAction,
  type FixedCostState,
  removeFixedCostAction,
} from './fixed-cost-actions';
export {
  deleteSpendEntryAction,
  type EditSpendEntryState,
  editSpendEntryAction,
  type RecordSpendState,
  recordSpendAction,
} from './spend-actions';
/**
 * Barrel re-export for trip server actions.
 *
 * Individual action groups live in their own modules:
 *   - trip-actions.ts       (edit trip, delete trip, move trip)
 *   - destination-actions.ts (add/edit/remove destination)
 *   - fixed-cost-actions.ts  (add/edit/remove fixed cost)
 *   - spend-actions.ts       (record/edit/delete spend entry)
 */
export {
  type DeleteTripState,
  deleteTripAction,
  type EditTripState,
  editTripAction,
  type MoveTripState,
  moveTripToOrganizationAction,
} from './trip-actions';
