import { describe, expect, it } from 'vitest';
import {
  AUTH_STATUS_BOOTSTRAP_RETRY_DELAY_MS,
  isTransientAuthStatusBootstrapError,
  shouldRetryAuthStatusBootstrap
} from './use-auth';

describe('auth status bootstrap retry policy', () => {
  it('retries transient transport failures during startup', () => {
    expect(isTransientAuthStatusBootstrapError(new Error('Failed to fetch'))).toBe(true);
    expect(isTransientAuthStatusBootstrapError(
      new Error('Timed out waiting for remote request response after 5000ms: GET /api/auth/status')
    )).toBe(true);
    expect(shouldRetryAuthStatusBootstrap(0, new Error('Remote transport connection closed.'))).toBe(true);
  });

  it('does not retry stable auth or API contract failures', () => {
    expect(isTransientAuthStatusBootstrapError(new Error('Authentication required.'))).toBe(false);
    expect(isTransientAuthStatusBootstrapError(
      new Error('Non-JSON response (404 Not Found) on GET /api/auth/status')
    )).toBe(false);
    expect(shouldRetryAuthStatusBootstrap(0, new Error('Authentication required.'))).toBe(false);
  });

  it('stops retrying after the bootstrap retry budget is exhausted', () => {
    expect(shouldRetryAuthStatusBootstrap(39, new Error('Failed to fetch'))).toBe(true);
    expect(shouldRetryAuthStatusBootstrap(40, new Error('Failed to fetch'))).toBe(false);
  });

  it('keeps the retry delay short and predictable', () => {
    expect(AUTH_STATUS_BOOTSTRAP_RETRY_DELAY_MS).toBe(250);
  });
});
