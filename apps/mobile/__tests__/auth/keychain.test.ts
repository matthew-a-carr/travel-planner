/**
 * keychain.ts test. Mocks `expo-secure-store` with in-memory backing
 * so assertions can read what was written and verify all three keys
 * land with the expected values.
 */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __mockStore: store,
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import * as SecureStore from 'expo-secure-store';
import { clearTokens, storeTokens } from '../../src/auth/keychain';

type SecureStoreMock = typeof SecureStore & {
  __mockStore: Map<string, string>;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const mockedStore = SecureStore as SecureStoreMock;

beforeEach(() => {
  mockedStore.__mockStore.clear();
  mockedStore.setItemAsync.mockClear();
  mockedStore.deleteItemAsync.mockClear();
});

describe('storeTokens', () => {
  it('writes all three keys with the supplied values', async () => {
    await storeTokens({
      access_token: 'eyJaccess',
      refresh_token: 'opaque-refresh',
      access_expires_at: '2026-05-20T12:15:00.000Z',
    });

    expect(mockedStore.__mockStore.get('travel_planner.access_token')).toBe('eyJaccess');
    expect(mockedStore.__mockStore.get('travel_planner.refresh_token')).toBe('opaque-refresh');
    expect(mockedStore.__mockStore.get('travel_planner.access_expires_at')).toBe(
      '2026-05-20T12:15:00.000Z',
    );
  });

  it('calls setItemAsync exactly three times', async () => {
    await storeTokens({
      access_token: 'a',
      refresh_token: 'b',
      access_expires_at: 'c',
    });
    expect(mockedStore.setItemAsync).toHaveBeenCalledTimes(3);
  });

  it('overwrites a previous bundle when called a second time', async () => {
    await storeTokens({
      access_token: 'old-access',
      refresh_token: 'old-refresh',
      access_expires_at: 'old-exp',
    });
    await storeTokens({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      access_expires_at: 'new-exp',
    });

    expect(mockedStore.__mockStore.get('travel_planner.access_token')).toBe('new-access');
    expect(mockedStore.__mockStore.get('travel_planner.refresh_token')).toBe('new-refresh');
    expect(mockedStore.__mockStore.get('travel_planner.access_expires_at')).toBe('new-exp');
  });
});

describe('clearTokens', () => {
  it('deletes all three keys', async () => {
    await storeTokens({
      access_token: 'a',
      refresh_token: 'b',
      access_expires_at: 'c',
    });
    await clearTokens();

    expect(mockedStore.__mockStore.has('travel_planner.access_token')).toBe(false);
    expect(mockedStore.__mockStore.has('travel_planner.refresh_token')).toBe(false);
    expect(mockedStore.__mockStore.has('travel_planner.access_expires_at')).toBe(false);
  });

  it('calls deleteItemAsync exactly three times', async () => {
    await clearTokens();
    expect(mockedStore.deleteItemAsync).toHaveBeenCalledTimes(3);
  });

  it('is a no-op (no error) when no tokens have been written', async () => {
    // Maps return undefined on missing keys; SecureStore.deleteItemAsync
    // on a missing key resolves normally. Test the wrapper doesn't throw.
    await expect(clearTokens()).resolves.toBeUndefined();
  });
});
