import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getViteInputs } from '../vite.mpa.js';

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
