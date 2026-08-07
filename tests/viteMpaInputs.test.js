import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getViteInputs, mpaTrailingSlashLocation } from '../vite.mpa.js';

describe('getViteInputs', () => {
  it('includes legacy root and v25 MPA HTML entries', () => {
    const root = path.resolve('/tmp/vhectorlab-fixture');
    const inputs = getViteInputs(root);
    expect(inputs).toEqual({
      main: path.resolve(root, 'index.html'),
      v25: path.resolve(root, 'v25/index.html'),
    });
  });
});

describe('mpaTrailingSlashLocation', () => {
  it('redirects bare /v25 to /v25/', () => {
    expect(mpaTrailingSlashLocation('/v25')).toBe('/v25/');
  });

  it('preserves query string', () => {
    expect(mpaTrailingSlashLocation('/v25?x=1')).toBe('/v25/?x=1');
  });

  it('leaves /v25/ and legacy / alone', () => {
    expect(mpaTrailingSlashLocation('/v25/')).toBeNull();
    expect(mpaTrailingSlashLocation('/')).toBeNull();
    expect(mpaTrailingSlashLocation('/v25/index.html')).toBeNull();
  });
});
