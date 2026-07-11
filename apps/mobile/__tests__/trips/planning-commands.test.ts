const mockGetAccessToken = jest.fn();
const mockApiPost = jest.fn();
const mockApiPatch = jest.fn();
const mockApiDelete = jest.fn();

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));
jest.mock('../../src/api/client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'planning-key' }));

import {
  createMobileDestination,
  deleteMobileFixedCost,
  updateMobileDestination,
} from '../../src/trips/planning-commands';

const destination = {
  name: 'Tokyo',
  country: 'Japan',
  city: null,
  latitude: null,
  longitude: null,
  estimatedBudgetPence: 100_000,
  comfortLevel: 'mid' as const,
  startDate: null,
  endDate: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue({ ok: true, token: 'token' });
});

describe('planning commands', () => {
  it('uses encoded nested resources and fresh idempotency keys', async () => {
    mockApiPost.mockResolvedValue({ ok: true, data: { id: 'd1' } });
    mockApiPatch.mockResolvedValue({ ok: true, data: { id: 'd/1' } });
    mockApiDelete.mockResolvedValue({ ok: true, data: undefined });
    await createMobileDestination('trip/1', destination);
    await updateMobileDestination('trip/1', 'd/1', destination);
    await deleteMobileFixedCost('trip/1', 'f/1');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1/destinations',
      destination,
      expect.anything(),
      'token',
      'planning-key',
    );
    expect(mockApiPatch).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1/destinations/d%2F1',
      destination,
      expect.anything(),
      'token',
      'planning-key',
    );
    expect(mockApiDelete).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1/fixed-costs/f%2F1',
      'token',
      'planning-key',
    );
  });

  it('surfaces server detail and stops before I/O without a session', async () => {
    mockApiPost.mockResolvedValueOnce({ ok: false, error: { detail: 'Budget exceeded.' } });
    expect(await createMobileDestination('trip-1', destination)).toEqual({
      ok: false,
      message: 'Budget exceeded.',
    });
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'missing' });
    await deleteMobileFixedCost('trip-1', 'f1');
    expect(mockApiDelete).not.toHaveBeenCalled();
  });
});
