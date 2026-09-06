import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/react', () => {
  throw new Error('The closed assistant must not load the chat SDK');
});

it('renders the closed assistant without loading the chat SDK', async () => {
  const { TripAssistantDrawer } = await import('./TripAssistantDrawer');
  const html = renderToStaticMarkup(createElement(TripAssistantDrawer, {
    tripId: 'trip-1', suggestedPrompts: [],
  }));
  expect(html).toContain('Open trip assistant');
  expect(html).not.toContain('role="dialog"');
});
