import { describe, expect, it, vi } from 'vitest';
import {
  formatBootProgressLabel,
  resolveBootProgressBar,
  softWaitRatio,
  softStepRatio,
  withTimeout,
  waitForBackendHealthy,
  startProgressTicker,
  withSoftStepProgress,
} from '../src/ui/BootProgress.js';

describe('BootProgress helpers', () => {
  it('formatBootProgressLabel prefers statusText then k/n label', () => {
    expect(formatBootProgressLabel({ statusText: '1/3 Encoding…' })).toBe('1/3 Encoding…');
    expect(formatBootProgressLabel({ step: 2, total: 4, label: 'UMAP' })).toBe('2/4 UMAP');
    expect(formatBootProgressLabel({ label: 'Connecting…' })).toBe('Connecting…');
    expect(formatBootProgressLabel(null)).toBe('');
  });

  it('resolveBootProgressBar maps ratio and indeterminate', () => {
    expect(resolveBootProgressBar({ ratio: 0.66 })).toEqual({
      pct: 66,
      indeterminate: false,
    });
    expect(resolveBootProgressBar({ step: 1, total: 4 })).toEqual({
      pct: 25,
      indeterminate: false,
    });
    expect(resolveBootProgressBar({
      statusText: 'Connecting…',
      indeterminate: true,
    })).toEqual({ pct: 0, indeterminate: true });
  });

  it('softWaitRatio climbs then caps under 1', () => {
    expect(softWaitRatio(0)).toBe(0);
    expect(softWaitRatio(45_000, 90_000)).toBeCloseTo(0.5);
    expect(softWaitRatio(200_000, 90_000)).toBe(0.92);
  });

  it('softStepRatio stays inside the step band and climbs', () => {
    const early = softStepRatio(1, 3, 0, 30_000);
    const mid = softStepRatio(1, 3, 15_000, 30_000);
    const late = softStepRatio(1, 3, 60_000, 30_000);
    expect(early).toBeCloseTo(0);
    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeLessThan(1 / 3);
    expect(late).toBeGreaterThan(mid);
    expect(late).toBeLessThan(1 / 3);
  });

  it('withTimeout resolves fallback when promise is slow', async () => {
    const slow = new Promise(() => {});
    const result = await withTimeout(slow, 20, { ok: false });
    expect(result).toEqual({ ok: false });
  });

  it('withTimeout returns promise value when fast', async () => {
    const result = await withTimeout(Promise.resolve(42), 100, 0);
    expect(result).toBe(42);
  });

  it('startProgressTicker fires while a hung await is in flight', async () => {
    const ticks = [];
    const stop = startProgressTicker(() => ticks.push(Date.now()), 40);
    await new Promise((r) => setTimeout(r, 130));
    stop();
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });

  it('waitForBackendHealthy polls until ok and reports live progress during hung checks', async () => {
    let n = 0;
    const ticks = [];
    const health = await waitForBackendHealthy({
      attemptTimeoutMs: 80,
      gapMs: 10,
      tickMs: 30,
      maxWaitMs: 3000,
      checkHealth: async () => {
        n += 1;
        // First two attempts hang past abort window → ticker must still move.
        if (n < 3) {
          await new Promise(() => {});
        }
        return { ok: true, data: { model: 'x' } };
      },
      onProgress: (p) => ticks.push({ text: p.statusText, ratio: p.ratio }),
    });
    expect(health.ok).toBe(true);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks[0].text).toMatch(/Waiting for backend/);
    const ratios = ticks.map((t) => t.ratio);
    expect(Math.max(...ratios)).toBeGreaterThan(ratios[0]);
  });

  it('withSoftStepProgress advances ratio while work runs', async () => {
    const ticks = [];
    const result = await withSoftStepProgress(
      {
        step: 2,
        total: 4,
        label: 'UMAP',
        expectMs: 200,
        tickMs: 30,
        onProgress: (p) => ticks.push(p.ratio),
      },
      async () => {
        await new Promise((r) => setTimeout(r, 100));
        return 'done';
      },
    );
    expect(result).toBe('done');
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeGreaterThanOrEqual(0.25);
    expect(ticks[0]).toBeLessThan(0.5);
    expect(Math.max(...ticks)).toBeGreaterThan(ticks[0]);
    expect(Math.max(...ticks)).toBeLessThan(0.5);
  });
});
