import { describe, it, expect } from 'vitest';
import {
  ARITHMETIC_THREAD_ORDER,
  arithmeticSequenceIndex,
  arithmeticThreadLabel,
} from '../src/ui/threadLabelFormat.js';

describe('threadLabelFormat', () => {
  it('exposes arithmetic short labels', () => {
    expect(arithmeticThreadLabel('A')).toBe('WORD_A');
    expect(arithmeticThreadLabel('B')).toBe('WORD_B');
    expect(arithmeticThreadLabel('C')).toBe('WORD_C');
    expect(arithmeticThreadLabel('RES')).toBe('RES');
    expect(arithmeticThreadLabel('TOP1')).toBe('TOP1');
  });

  it('orders slots WORD_A → WORD_B → WORD_C → RES → TOP1', () => {
    expect(ARITHMETIC_THREAD_ORDER).toEqual(['A', 'B', 'C', 'RES', 'TOP1']);
    expect(arithmeticSequenceIndex('A')).toBe(0);
    expect(arithmeticSequenceIndex('B')).toBe(1);
    expect(arithmeticSequenceIndex('C')).toBe(2);
    expect(arithmeticSequenceIndex('RES')).toBe(3);
    expect(arithmeticSequenceIndex('TOP1')).toBe(4);
  });
});
