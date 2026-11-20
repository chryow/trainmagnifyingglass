import type { AuthError } from '@supabase/supabase-js';

/**
 * Turns Supabase auth errors into messages people can act on. Some failures
 * (e.g. an email server timeout) come back with an empty message, which
 * previously rendered as "{}".
 */
export function friendlyAuthError(err: AuthError | Error | null | undefined, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback;
  const status = (err as AuthError).status;
  const msg = typeof err.message === 'string' ? err.message.trim() : '';

  if (status === 429 || /rate limit/i.test(msg)) {
    return 'Too many emails were requested. Please wait a few minutes and try again.';
  }
  if (status === 504 || status === 502 || /timeout|sending (confirmation|recovery) email|smtp/i.test(msg)) {
    return "We couldn't send the email right now. Please try again in a few minutes.";
  }
  if (!msg || msg === '{}') return fallback;
  return msg;
}
