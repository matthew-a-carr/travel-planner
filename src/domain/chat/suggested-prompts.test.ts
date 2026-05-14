import { describe, expect, it } from 'vitest';
import { moneyUnchecked as money } from '../trip/types';
import type { Destination, TripStatus } from '../trip/types';
import { getSuggestedPrompts } from './suggested-prompts';

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'dest-1',
    tripId: 'trip-1',
    name: 'Hanoi',
    country: 'Vietnam',
    city: 'Hanoi',
    latitude: null,
    longitude: null,
    estimatedBudget: money(500_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: null,
    endDate: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function call(overrides: {
  tripStatus?: TripStatus;
  destinations?: readonly Destination[];
  hasSpend?: boolean;
  currentDate?: Date;
}) {
  return getSuggestedPrompts({
    tripStatus: overrides.tripStatus ?? 'planning',
    destinations: overrides.destinations ?? [],
    hasSpend: overrides.hasSpend ?? false,
    currentDate: overrides.currentDate ?? new Date('2026-08-01'),
  });
}

describe('getSuggestedPrompts', () => {
  it('returns recap prompts for completed trips', () => {
    const prompts = call({ tripStatus: 'completed' });
    expect(prompts).toHaveLength(3);
    expect(prompts.map((p) => p.label)).toContain('Summarise this trip');
    expect(prompts.every((p) => p.prompt.length > 0)).toBe(true);
  });

  it('returns active-phase prompts when status is active', () => {
    const prompts = call({
      tripStatus: 'active',
      destinations: [
        makeDestination({
          id: 'd1',
          name: 'Hanoi',
          startDate: new Date('2026-07-25'),
          endDate: new Date('2026-08-05'),
        }),
      ],
      currentDate: new Date('2026-08-01'),
    });
    const labels = prompts.map((p) => p.label);
    expect(labels).toContain('How am I tracking?');
    expect(labels).toContain('Log a spend');
    expect(labels).toContain("What's next?");
  });

  it('treats planning status with spend as active', () => {
    const prompts = call({
      tripStatus: 'planning',
      hasSpend: true,
    });
    expect(prompts.map((p) => p.label)).toContain('How am I tracking?');
  });

  it('templates the spend prompt with the active destination name', () => {
    const prompts = call({
      tripStatus: 'active',
      destinations: [
        makeDestination({
          id: 'd1',
          name: 'Hanoi',
          startDate: new Date('2026-07-25'),
          endDate: new Date('2026-08-05'),
        }),
      ],
      currentDate: new Date('2026-08-01'),
    });
    const spendChip = prompts.find((p) => p.label === 'Log a spend');
    expect(spendChip?.prompt).toContain('in Hanoi');
  });

  it('falls back to the upcoming destination when no range covers today', () => {
    const prompts = call({
      tripStatus: 'active',
      destinations: [
        makeDestination({
          id: 'd1',
          name: 'Hanoi',
          startDate: new Date('2026-07-25'),
          endDate: new Date('2026-07-30'),
        }),
        makeDestination({
          id: 'd2',
          name: 'Phnom Penh',
          country: 'Cambodia',
          city: 'Phnom Penh',
          startDate: new Date('2026-08-05'),
          endDate: new Date('2026-08-15'),
        }),
      ],
      currentDate: new Date('2026-08-01'),
    });
    const spendChip = prompts.find((p) => p.label === 'Log a spend');
    expect(spendChip?.prompt).toContain('in Phnom Penh');
  });

  it('falls back to the most recent past destination when nothing upcoming', () => {
    const prompts = call({
      tripStatus: 'active',
      destinations: [
        makeDestination({
          id: 'd1',
          name: 'Hanoi',
          startDate: new Date('2026-07-01'),
          endDate: new Date('2026-07-10'),
        }),
        makeDestination({
          id: 'd2',
          name: 'Phnom Penh',
          country: 'Cambodia',
          city: 'Phnom Penh',
          startDate: new Date('2026-07-12'),
          endDate: new Date('2026-07-20'),
        }),
      ],
      currentDate: new Date('2026-08-01'),
    });
    const spendChip = prompts.find((p) => p.label === 'Log a spend');
    expect(spendChip?.prompt).toContain('in Phnom Penh');
  });

  it('omits the destination phrase if no dated destinations exist', () => {
    const prompts = call({
      tripStatus: 'active',
      destinations: [makeDestination({ id: 'd1', name: 'Tokyo', country: 'Japan' })],
    });
    const spendChip = prompts.find((p) => p.label === 'Log a spend');
    expect(spendChip?.prompt).not.toContain(' in ');
    expect(spendChip?.prompt).toContain('£12');
  });

  it('returns empty-phase prompts when no destinations and no spend', () => {
    const prompts = call({ tripStatus: 'planning', destinations: [] });
    const labels = prompts.map((p) => p.label);
    expect(labels).toContain('Where to start?');
    expect(labels).toContain('Add a fixed cost');
    expect(labels).toContain('Set the budget');
  });

  it('returns planning prompts when destinations exist but no spend', () => {
    const prompts = call({
      tripStatus: 'planning',
      destinations: [makeDestination({ id: 'd1', country: 'Japan', name: 'Tokyo' })],
    });
    const labels = prompts.map((p) => p.label);
    expect(labels).toContain('Suggest a budget');
    const budgetChip = prompts.find((p) => p.label === 'Suggest a budget');
    expect(budgetChip?.prompt).toContain('Japan');
  });

  it('picks the chronologically-first destination for planning prompts', () => {
    const prompts = call({
      tripStatus: 'planning',
      destinations: [
        makeDestination({
          id: 'd2',
          name: 'Tokyo',
          country: 'Japan',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-10'),
          sortOrder: 1,
        }),
        makeDestination({
          id: 'd1',
          name: 'Hanoi',
          country: 'Vietnam',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-15'),
          sortOrder: 0,
        }),
      ],
    });
    const transport = prompts.find((p) => p.label === 'Plan transport');
    expect(transport?.prompt).toContain('Vietnam');
  });
});
