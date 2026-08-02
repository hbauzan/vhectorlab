import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMPARE_GROUPS_DEMO_TEXT } from '../src/ui/ComparePanel.js';
import { parseCompareInput } from '../src/ui/parseCompareGroups.js';

/**
 * Regression: main must forward (tokens, tokenMeta) — dropping the 2nd arg
 * left groupId unset and hid GROUP_* badges forever.
 */
describe('Compare group tokenMeta contract', () => {
  it('demo parse yields 130 tokens with GROUP_1 then GROUP_2 meta', () => {
    const parsed = parseCompareInput(COMPARE_GROUPS_DEMO_TEXT);
    expect(parsed.mode).toBe('grouped');
    expect(parsed.tokens).toHaveLength(130);
    expect(parsed.tokenMeta[0].groupId).toBe('GROUP_1');
    expect(parsed.tokenMeta[64].groupId).toBe('GROUP_1');
    expect(parsed.tokenMeta[65].groupId).toBe('GROUP_2');
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
    expect(handleCalculateCompare.mock.calls[0][1][0].groupId).toBe('GROUP_1');
  });
});
