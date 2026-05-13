import { describe, expect, it } from 'vitest';
import {
  isTransientAuthStatusBootstrapError,
  resolveAuthStatusBootstrapRetryDelay,
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
    expect(shouldRetryAuthStatusBootstrap(7, new Error('Failed to fetch'))).toBe(true);
    expect(shouldRetryAuthStatusBootstrap(8, new Error('Failed to fetch'))).toBe(false);
  });

  it('backs off retry delay without becoming sluggish', () => {
    expect(resolveAuthStatusBootstrapRetryDelay(1)).toBe(500);
    expect(resolveAuthStatusBootstrapRetryDelay(2)).toBe(1000);
    expect(resolveAuthStatusBootstrapRetryDelay(4)).toBe(3000);
  });
});
