import type { FixedCostCategory } from '@/domain/trip/types';
import type { ChecklistCategory, TransportMode } from './types';

/**
 * Maps a `ChecklistCategory` (the planner's domain) onto the existing
 * `FixedCostCategory` enum so the UI's "Add as fixed cost" form posts a
 * value the existing `addFixedCostAction` already accepts.
 *
 * `banking` and `admin` fall through to `'other'` — the existing
 * `FixedCostCategory` enum has no closer match. Adding new
 * fixed-cost categories is out of scope for this slice; the user can
 * relabel after the fact.
 */
export function checklistCategoryToFixedCostCategory(
  category: ChecklistCategory,
): FixedCostCategory {
  switch (category) {
    case 'visa':
      return 'visas';
    case 'vaccination':
      return 'healthcare';
    case 'insurance':
      return 'insurance';
    case 'banking':
    case 'admin':
      return 'other';
  }
}

/**
 * All transport legs map to the `transport` fixed-cost category. Kept
 * as a tiny helper so callers don't need to import the enum directly.
 */
export function transportLegFixedCostCategory(): FixedCostCategory {
  return 'transport';
}

/**
 * Builds the human-readable label used as the fixed-cost row's `label`
 * (and as the dedupe key against existing fixed costs).
 */
export function transportLegLabel(mode: TransportMode, fromName: string, toName: string): string {
  const verb = mode === 'flight' ? 'Flight' : labelForMode(mode);
  return `${verb}: ${fromName} → ${toName}`;
}

function labelForMode(mode: TransportMode): string {
  switch (mode) {
    case 'train':
      return 'Train';
    case 'bus':
      return 'Bus';
    case 'ferry':
      return 'Ferry';
    case 'car':
      return 'Car/road';
    case 'flight':
      return 'Flight';
  }
}
