import { describe, expect, it } from 'vitest';
import { formatChatStreamError } from './format-chat-stream-error';

describe('formatChatStreamError', () => {
  it('returns the gateway-quota message for Vercel "no_providers_available" responses', () => {
    const gatewayBody = JSON.stringify({
      error: {
        message: 'Free credits temporarily have restricted access due to abuse.',
        type: 'no_providers_available',
        param: { statusCode: 403, name: 'RestrictedModelsError' },
      },
    });
    const message = formatChatStreamError(new Error(gatewayBody));
    expect(message).toBe(
      'AI is temporarily unavailable — the gateway quota has been reached. Try again later.',
    );
  });

  it('matches RestrictedModelsError by name', () => {
    const err = new Error('RestrictedModelsError: Free credits exhausted');
    expect(formatChatStreamError(err)).toContain('gateway quota');
  });

  it('returns the auth-rejected message for a plain 403', () => {
    expect(formatChatStreamError(new Error('Request failed with status 403'))).toBe(
      'AI service rejected the request — please contact the site owner.',
    );
  });

  it('returns the network message for fetch failures', () => {
    expect(formatChatStreamError(new Error('fetch failed: ENOTFOUND'))).toBe(
      'Could not reach the AI service. Check your connection and try again.',
    );
  });

  it('returns the timeout message for 504 / AbortError / "timeout" text', () => {
    expect(formatChatStreamError(new Error('504 Gateway Timeout'))).toContain('took too long');
    expect(formatChatStreamError(new Error('AbortError: stream aborted'))).toContain(
      'took too long',
    );
    expect(formatChatStreamError(new Error('request timeout'))).toContain('took too long');
  });

  it('passes through short, plain error messages verbatim', () => {
    const message = formatChatStreamError(new Error('Model returned an empty response'));
    expect(message).toBe('Model returned an empty response');
  });

  it('falls back when the message is very long or empty', () => {
    expect(formatChatStreamError(new Error(''))).toBe(
      'Something went wrong sending your message. Try again.',
    );
    expect(formatChatStreamError(new Error('x'.repeat(500)))).toBe(
      'Something went wrong sending your message. Try again.',
    );
    expect(formatChatStreamError(undefined)).toBe(
      'Something went wrong sending your message. Try again.',
    );
  });

  it('extracts text from non-Error inputs and structured objects', () => {
    expect(formatChatStreamError('plain string error')).toBe('plain string error');
    expect(
      formatChatStreamError({ message: 'Free credits temporarily restricted' }),
    ).toContain('gateway quota');
  });

  it('inspects Error.cause for nested gateway errors', () => {
    const cause = JSON.stringify({ type: 'no_providers_available' });
    const err = new Error('Upstream call failed', { cause });
    expect(formatChatStreamError(err)).toContain('gateway quota');
  });
});
