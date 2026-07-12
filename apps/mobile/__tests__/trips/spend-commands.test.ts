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
jest.mock('expo-crypto', () => ({ randomUUID: () => 'spend-key' }));

import {
  createMobileSpend,
  deleteMobileSpend,
  updateMobileSpend,
} from '../../src/trips/spend-commands';

const createInput = {
  destinationId: 'destination-1',
  amountPence: 2500,
  category: 'food' as const,
  description: 'Ramen',
  spentAt: '2026-06-02',
};
const { destinationId: _destinationId, ...updateInput } = createInput;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue({ ok: true, token: 'token' });
});

describe('spend commands', () => {
  it('uses encoded nested resources and fresh idempotency keys', async () => {
    mockApiPost.mockResolvedValue({ ok: true, data: { id: 's1' } });
    mockApiPatch.mockResolvedValue({ ok: true, data: { id: 's/1' } });
    mockApiDelete.mockResolvedValue({ ok: true, data: undefined });

    await createMobileSpend('trip/1', createInput);
    await updateMobileSpend('trip/1', 's/1', updateInput);
    await deleteMobileSpend('trip/1', 's/1');

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1/spend',
      createInput,
      expect.anything(),
      'token',
      'spend-key',
    );
    expect(mockApiPatch).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1/spend/s%2F1',
      updateInput,
      expect.anything(),
      'token',
      'spend-key',
    );
    expect(mockApiDelete).toHaveBeenCalledWith(
      '/api/v1/trips/trip%2F1/spend/s%2F1',
      'token',
      'spend-key',
    );
  });

  it('surfaces server detail and stops before I/O without a session', async () => {
    mockApiPost.mockResolvedValueOnce({ ok: false, error: { detail: 'Destination not found.' } });
    expect(await createMobileSpend('trip-1', createInput)).toEqual({
      ok: false,
      message: 'Destination not found.',
    });
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'missing' });
    await deleteMobileSpend('trip-1', 's1');
    expect(mockApiDelete).not.toHaveBeenCalled();
  });
});
