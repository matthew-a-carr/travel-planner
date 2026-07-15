const mockGetAccessToken = jest.fn();
const mockApiPost = jest.fn();
const mockApiPatch = jest.fn();
const mockApiDelete = jest.fn();
const mockRandomUUID = jest.fn(() => 'command-key');

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));
jest.mock('../../src/api/client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

import {
  createMobileTrip,
  deleteMobileTrip,
  updateMobileTrip,
} from '../../src/trips/trip-commands';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue({ ok: true, token: 'access-token' });
});

describe('trip commands', () => {
  it('creates with the shared wire shape and a fresh idempotency key', async () => {
    mockApiPost.mockResolvedValue({ ok: true, data: { id: 'trip-1' } });

    await createMobileTrip({ organizationId: 'org-1', name: 'Japan', totalBudgetPence: 500_000 });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/trips',
      { organizationId: 'org-1', name: 'Japan', totalBudgetPence: 500_000 },
      expect.anything(),
      'access-token',
      'command-key',
    );
  });

  it('updates and deletes the encoded trip resource', async () => {
    mockApiPatch.mockResolvedValue({ ok: true, data: { id: 'trip/1' } });
    mockApiDelete.mockResolvedValue({ ok: true, data: undefined });

    await updateMobileTrip('trip/1', {
      name: 'Updated',
      totalBudgetPence: 600_000,
      status: 'active',
    });
    await deleteMobileTrip('trip/1');

    expect(mockApiPatch).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1',
      { name: 'Updated', totalBudgetPence: 600_000, status: 'active' },
      expect.anything(),
      'access-token',
      'command-key',
    );
    expect(mockApiDelete).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1',
      'access-token',
      'command-key',
    );
  });

  it('returns a session-expired failure without calling the API', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'missing' });

    const result = await deleteMobileTrip('trip-1');

    expect(result).toEqual({
      ok: false,
      message: 'Your session has expired. Please sign in again.',
    });
    expect(mockApiDelete).not.toHaveBeenCalled();
  });
});
