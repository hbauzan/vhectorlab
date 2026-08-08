import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getViteInputs, mpaTrailingSlashLocation } from '../vite.mpa.js';

describe('getViteInputs', () => {
  it('includes only the legacy root HTML entry', () => {
    const root = path.resolve('/tmp/vhectorlab-fixture');
    const inputs = getViteInputs(root);
    expect(inputs).toEqual({
      main: path.resolve(root, 'index.html'),
    });
  });
});

describe('mpaTrailingSlashLocation', () => {
  it('does not redirect retired /v25 or /amiga by default', () => {
    expect(mpaTrailingSlashLocation('/v25')).toBeNull();
    expect(mpaTrailingSlashLocation('/amiga')).toBeNull();
    expect(mpaTrailingSlashLocation('/')).toBeNull();
  });

  it('still redirects when dirs are passed explicitly', () => {
    expect(mpaTrailingSlashLocation('/legacy', ['/legacy'])).toBe('/legacy/');
    expect(mpaTrailingSlashLocation('/legacy?x=1', ['/legacy'])).toBe('/legacy/?x=1');
  });
});
