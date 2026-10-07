import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchGoogleOAuthClient } from './google-oauth-client';

const input = { code: 'authorization-code', redirectUri: 'https://example.com/callback' };
const profile = { sub: 'google-user', email: 'member@example.com', name: 'Member' };

afterEach(() => vi.useRealTimers());

describe('FetchGoogleOAuthClient', () => {
  it('returns a verified Google profile', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'token' }))
      .mockResolvedValueOnce(Response.json({ ...profile, email_verified: true }));

    const client = new FetchGoogleOAuthClient('client', 'secret', fetchImpl);
    expect(await client.exchangeAuthCode(input)).toEqual({
      ok: true,
      profile: { googleId: profile.sub, email: profile.email, name: profile.name },
    });
  });

  it.each([false, null, undefined, 'false', '0'])('rejects an unverified email: %j', async (verified) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'token' }))
      .mockResolvedValueOnce(Response.json({ ...profile, email_verified: verified }));

    const client = new FetchGoogleOAuthClient('client', 'secret', fetchImpl);
    expect(await client.exchangeAuthCode(input)).toEqual({ ok: false, error: 'malformed_response' });
  });

  it.each(['token', 'profile', 'body'])('bounds a stalled %s response', async (stage) => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const call = fetchImpl.mock.calls.length;
      if (stage === 'token' || (stage === 'profile' && call === 2)) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      }
      if (call === 1) return Response.json({ access_token: 'token' });
      if (stage === 'body') {
        return new Response(new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
          },
        }));
      }
      return Response.json({ ...profile, email_verified: true });
    });
    const client = new FetchGoogleOAuthClient('client', 'secret', fetchImpl);
    const pending = client.exchangeAuthCode(input);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, error: 'network_error' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
