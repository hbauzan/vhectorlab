import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getViteInputs, mpaTrailingSlashLocation } from '../vite.mpa.js';

describe('getViteInputs', () => {
  it('includes legacy root, v25, and amiga MPA HTML entries', () => {
    const root = path.resolve('/tmp/vhectorlab-fixture');
    const inputs = getViteInputs(root);
    expect(inputs).toEqual({
      main: path.resolve(root, 'index.html'),
      v25: path.resolve(root, 'v25/index.html'),
      amiga: path.resolve(root, 'amiga/index.html'),
    });
  });
});

describe('mpaTrailingSlashLocation', () => {
  it('redirects bare /v25 to /v25/', () => {
    expect(mpaTrailingSlashLocation('/v25')).toBe('/v25/');
  });

  it('redirects bare /amiga to /amiga/', () => {
    expect(mpaTrailingSlashLocation('/amiga')).toBe('/amiga/');
  });

  it('preserves query string', () => {
    expect(mpaTrailingSlashLocation('/v25?x=1')).toBe('/v25/?x=1');
    expect(mpaTrailingSlashLocation('/amiga?x=1')).toBe('/amiga/?x=1');
  });

  it('leaves trailing-slash MPA paths and legacy / alone', () => {
    expect(mpaTrailingSlashLocation('/v25/')).toBeNull();
    expect(mpaTrailingSlashLocation('/amiga/')).toBeNull();
    expect(mpaTrailingSlashLocation('/')).toBeNull();
    expect(mpaTrailingSlashLocation('/v25/index.html')).toBeNull();
    expect(mpaTrailingSlashLocation('/amiga/index.html')).toBeNull();
  });
});
