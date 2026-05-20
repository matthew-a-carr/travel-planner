/**
 * Jest test framework setup. Runs after Jest's test globals are
 * initialised; the right place to extend `expect` with RNTL matchers
 * and to wire msw/native server lifecycle hooks.
 */

import '@testing-library/react-native/extend-expect';

// msw/native server lifecycle. Activated once a test actually mocks
// an API call (slice 6 onward).
//
// import { server } from './__mocks__/msw-server';
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());
