import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl, apiUrl } from '../src/core/RemoteProvider.js';

describe('resolveApiBaseUrl', () => {
  it('uses env override when set', () => {
    expect(resolveApiBaseUrl({
      envBase: 'https://api-xyz.ngrok-free.dev/',
      hostname: 'obsessed-landfall-irritable.ngrok-free.dev',
    })).toBe('https://api-xyz.ngrok-free.dev');
  });

  it('uses localhost backend on desktop local', () => {
    expect(resolveApiBaseUrl({ envBase: '', hostname: 'localhost' }))
      .toBe('http://127.0.0.1:8000');
    expect(resolveApiBaseUrl({ envBase: undefined, hostname: '127.0.0.1' }))
      .toBe('http://127.0.0.1:8000');
  });

  it('uses same-origin /api behind ngrok (Vite proxy)', () => {
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
