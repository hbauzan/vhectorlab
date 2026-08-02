import { describe, it, expect } from 'vitest';
import {
  THREAD_LABEL_TOKEN_MAX,
  truncateToken,
  arithmeticThreadLabel,
  compareThreadLabel,
} from '../src/ui/threadLabelFormat.js';

describe('threadLabelFormat', () => {
  it('exposes arithmetic short labels', () => {
    expect(arithmeticThreadLabel('A')).toBe('WORD_A');
    expect(arithmeticThreadLabel('B')).toBe('WORD_B');
    expect(arithmeticThreadLabel('C')).toBe('WORD_C');
    expect(arithmeticThreadLabel('RES')).toBe('RES');
    expect(arithmeticThreadLabel('TOP1')).toBe('TOP1');
  });

  it('truncates tokens to max 10 chars', () => {
    expect(THREAD_LABEL_TOKEN_MAX).toBe(10);
    expect(truncateToken('queen')).toBe('queen');
    expect(truncateToken('abcdefghij')).toBe('abcdefghij');
    expect(truncateToken('abcdefghijk')).toBe('abcdefghij');
    expect(truncateToken('  padded_token_x  ')).toBe('padded_tok');
  });

  it('formats compare as TOPn + short token', () => {
    expect(compareThreadLabel(1, 'king')).toBe('TOP1 king');
    expect(compareThreadLabel(2, 'queen')).toBe('TOP2 queen');
    expect(compareThreadLabel(3, 'verylongtokenname')).toBe('TOP3 verylongto');
  });
});
