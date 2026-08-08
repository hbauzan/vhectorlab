import { describe, it, expect, vi } from 'vitest';
import {
  COMPARE_GROUPS_DEMO_TEXT,
  WOMEN_GROUP_ID,
  VEHICLES_GROUP_ID,
  WOMEN_NAMES_EN,
} from '../src/ui/ComparePanel.js';
import { parseCompareInput } from '../src/ui/parseCompareGroups.js';

/**
 * Regression: main must forward (tokens, tokenMeta) — dropping the 2nd arg
 * left groupId unset and hid GROUP_* badges forever.
 */
describe('Compare group tokenMeta contract', () => {
  it('demo parse yields 130 tokens with vehicles then women meta', () => {
    expect(WOMEN_NAMES_EN).toHaveLength(65);
    expect(new Set(WOMEN_NAMES_EN).size).toBe(65);
    const parsed = parseCompareInput(COMPARE_GROUPS_DEMO_TEXT);
    expect(parsed.mode).toBe('grouped');
    expect(parsed.tokens).toHaveLength(130);
    expect(parsed.tokenMeta[0].groupId).toBe(VEHICLES_GROUP_ID);
    expect(parsed.tokenMeta[64].groupId).toBe(VEHICLES_GROUP_ID);
    expect(parsed.tokenMeta[65].groupId).toBe(WOMEN_GROUP_ID);
    expect(parsed.tokens[65]).toBe('sophia');
  });

  it('callback arity must accept tokenMeta (simulate main wiring)', async () => {
    const handleCalculateCompare = vi.fn(async (_tokens, _tokenMeta) => {});
    // Correct wiring (the bug was: async (tokens) => handle(tokens) — meta dropped)
    const onCalculate = async (tokens, tokenMeta) => handleCalculateCompare(tokens, tokenMeta);

    const parsed = parseCompareInput(COMPARE_GROUPS_DEMO_TEXT);
    await onCalculate(parsed.tokens, parsed.tokenMeta);

    expect(handleCalculateCompare).toHaveBeenCalledWith(
      parsed.tokens,
      parsed.tokenMeta,
    );
    expect(handleCalculateCompare.mock.calls[0][1][0].groupId).toBe(VEHICLES_GROUP_ID);
  });
});
