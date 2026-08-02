import { describe, it, expect } from 'vitest';
import { arithmeticThreadLabel } from '../src/ui/threadLabelFormat.js';

describe('threadLabelFormat', () => {
  it('exposes arithmetic short labels', () => {
    expect(arithmeticThreadLabel('A')).toBe('WORD_A');
    expect(arithmeticThreadLabel('B')).toBe('WORD_B');
    expect(arithmeticThreadLabel('C')).toBe('WORD_C');
    expect(arithmeticThreadLabel('RES')).toBe('RES');
    expect(arithmeticThreadLabel('TOP1')).toBe('TOP1');
  });
});
