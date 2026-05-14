import { sortDestinations } from '@/domain/destination/destination';
import type { Destination, TripStatus } from '@/domain/trip/types';

/**
 * One pre-fill suggestion shown beneath the empty chat state. Clicking a
 * chip populates the textarea with `prompt`; the user can edit before
 * sending (intended for templates with placeholders like "£12").
 */
export type SuggestedPrompt = {
  readonly label: string;
  readonly prompt: string;
};

export type SuggestedPromptsInput = {
  readonly tripStatus: TripStatus;
  readonly destinations: readonly Destination[];
  readonly hasSpend: boolean;
  readonly currentDate: Date;
};

/**
 * Returns up to three chips for the trip-assistant drawer's empty state,
 * picked from a small pool keyed off the trip's lifecycle phase. The
 * "active destination" used in spend-recording templates is the dated
 * destination whose range covers `currentDate`; if none does, the next
 * upcoming dated destination wins; if none does either, the last one
 * with dates.
 */
export function getSuggestedPrompts(input: SuggestedPromptsInput): readonly SuggestedPrompt[] {
  const { tripStatus, destinations, hasSpend, currentDate } = input;

  if (tripStatus === 'completed') {
    return [
      { label: 'Summarise this trip', prompt: 'Summarise this trip.' },
      { label: 'Top spending categories', prompt: 'What did I spend the most on?' },
      { label: 'Budget vs actual', prompt: 'How did my actual spend compare to my budget?' },
    ];
  }

  const isActive = tripStatus === 'active' || hasSpend;
  if (isActive) {
    const focus = findActiveDestination(destinations, currentDate);
    const where = focus ? ` in ${focus.name}` : '';
    return [
      { label: 'How am I tracking?', prompt: 'How am I tracking on budget?' },
      { label: 'Log a spend', prompt: `I spent £12 on lunch${where} today.` },
      { label: "What's next?", prompt: 'What destination is coming up next?' },
    ];
  }

  if (destinations.length === 0) {
    return [
      {
        label: 'Where to start?',
        prompt: "I'm planning this trip from scratch. What should I add first?",
      },
      { label: 'Add a fixed cost', prompt: 'Add £200 for visas on 1 August.' },
      { label: 'Set the budget', prompt: 'Set my total budget to £4,000.' },
    ];
  }

  const sorted = sortDestinations(destinations);
  const first = sorted[0];
  return [
    { label: 'Suggest a budget', prompt: `Suggest a budget for ${first.country}.` },
    { label: 'Headroom check', prompt: 'How much budget headroom do I have left?' },
    { label: 'Plan transport', prompt: `How should I get to ${first.country}?` },
  ];
}

function findActiveDestination(
  destinations: readonly Destination[],
  currentDate: Date,
): Destination | null {
  const now = currentDate.getTime();
  const dated = destinations.filter(
    (d): d is Destination & { startDate: Date; endDate: Date } =>
      d.startDate !== null && d.endDate !== null,
  );
  if (dated.length === 0) return null;

  const inRange = dated.find((d) => d.startDate.getTime() <= now && now <= d.endDate.getTime());
  if (inRange) return inRange;

  const upcoming = dated
    .filter((d) => d.startDate.getTime() > now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  if (upcoming[0]) return upcoming[0];

  const past = [...dated].sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  return past[0] ?? null;
}
