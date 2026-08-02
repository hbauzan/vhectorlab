import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl, apiUrl } from '../src/core/RemoteProvider.js';

describe('resolveApiBaseUrl', () => {
  it('uses env override when set', () => {
    expect(resolveApiBaseUrl({
      envBase: 'https://api-xyz.ngrok-free.dev/',
      hostname: 'obsessed-landfall-irritable.ngrok-free.dev',
    })).toBe('https://api-xyz.ngrok-free.dev');
  });

  it('honors VITE_API_BASE_URL=/api even on localhost (enabled default)', () => {
    // When env is set (as in .env / .env.example), it wins over hostname heuristics.
    expect(resolveApiBaseUrl({
      envBase: '/api',
      hostname: 'localhost',
    })).toBe('/api');
  });

  it('uses localhost backend when env is explicitly empty', () => {
    // Empty string = no override → hostname fallback (desktop direct to :8000).
    expect(resolveApiBaseUrl({ envBase: '', hostname: 'localhost' }))
      .toBe('http://127.0.0.1:8000');
    expect(resolveApiBaseUrl({ envBase: '', hostname: '127.0.0.1' }))
      .toBe('http://127.0.0.1:8000');
  });

  it('uses same-origin /api behind ngrok when env is empty', () => {
    expect(resolveApiBaseUrl({
      envBase: '',
      hostname: 'obsessed-landfall-irritable.ngrok-free.dev',
    })).toBe('/api');
  });
});

describe('apiUrl', () => {
  it('joins base and path', () => {
    expect(apiUrl('http://127.0.0.1:8000', '/health')).toBe('http://127.0.0.1:8000/health');
    expect(apiUrl('/api', '/health')).toBe('/api/health');
    expect(apiUrl('', '/health')).toBe('/health');
  });
});
