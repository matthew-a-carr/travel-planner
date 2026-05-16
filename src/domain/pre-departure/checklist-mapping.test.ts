import { describe, expect, it } from 'vitest';
import {
  checklistCategoryToFixedCostCategory,
  transportLegFixedCostCategory,
  transportLegLabel,
} from './checklist-mapping';

describe('checklistCategoryToFixedCostCategory', () => {
  it('maps each checklist category onto a valid FixedCostCategory', () => {
    expect(checklistCategoryToFixedCostCategory('visa')).toBe('visas');
    expect(checklistCategoryToFixedCostCategory('vaccination')).toBe('healthcare');
    expect(checklistCategoryToFixedCostCategory('insurance')).toBe('insurance');
    expect(checklistCategoryToFixedCostCategory('banking')).toBe('other');
    expect(checklistCategoryToFixedCostCategory('admin')).toBe('other');
  });
});

describe('transportLegFixedCostCategory', () => {
  it('always returns transport', () => {
    expect(transportLegFixedCostCategory()).toBe('transport');
  });
});

describe('transportLegLabel', () => {
  it('uses a mode-specific prefix and an arrow between place names', () => {
    expect(transportLegLabel('flight', 'Bangkok', 'Sydney')).toBe('Flight: Bangkok → Sydney');
    expect(transportLegLabel('train', 'Paris', 'Berlin')).toBe('Train: Paris → Berlin');
    expect(transportLegLabel('bus', 'Hanoi', 'Phnom Penh')).toBe('Bus: Hanoi → Phnom Penh');
    expect(transportLegLabel('ferry', 'Athens', 'Mykonos')).toBe('Ferry: Athens → Mykonos');
    expect(transportLegLabel('car', 'Sydney', 'Melbourne')).toBe('Car/road: Sydney → Melbourne');
  });
});
