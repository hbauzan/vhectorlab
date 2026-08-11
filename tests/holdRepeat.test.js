import { describe, it, expect, vi } from 'vitest';
import {
  holdRepeatIntervalMs,
  createHoldRepeatController,
} from '../src/ui/holdRepeat.js';

describe('holdRepeatIntervalMs', () => {
  it('uses initial delay for the first queued repeat (step 0)', () => {
    expect(holdRepeatIntervalMs(0)).toBe(280);
  });

  it('accelerates toward min interval', () => {
    const a = holdRepeatIntervalMs(1);
    const b = holdRepeatIntervalMs(8);
    const c = holdRepeatIntervalMs(40);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThanOrEqual(c);
    expect(c).toBe(28);
  });
});

describe('createHoldRepeatController', () => {
  it('fires immediately then repeats with accelerating cadence', () => {
    const ticks = [];
    /** @type {Array<{ id: number, ms: number, fn: Function }>} */
    const queue = [];
    let nextId = 1;
    const schedule = (fn, ms) => {
      const id = nextId;
      nextId += 1;
      queue.push({ id, ms, fn });
      return id;
    };
    const cancel = (id) => {
      const i = queue.findIndex((q) => q.id === id);
      if (i >= 0) queue.splice(i);
    };
    const flushOne = () => {
      const job = queue.shift();
      if (!job) return null;
      job.fn();
      return job.ms;
    };

    const ctrl = createHoldRepeatController({
      onTick: () => ticks.push(1),
      schedule,
      cancel,
    });

    ctrl.start();
    expect(ticks.length).toBe(1); // immediate
    expect(queue[0]?.ms).toBe(280);

    expect(flushOne()).toBe(280);
    expect(ticks.length).toBe(2);
    const secondGap = queue[0]?.ms;
    expect(secondGap).toBe(holdRepeatIntervalMs(1));

    flushOne();
    expect(ticks.length).toBe(3);
    expect(queue[0]?.ms).toBeLessThan(secondGap);

    ctrl.stop();
    expect(queue.length).toBe(0);
  });

  it('stop prevents further ticks', () => {
    const onTick = vi.fn();
    /** @type {Array<{ id: number, fn: Function }>} */
    const queue = [];
    let nextId = 1;
    const ctrl = createHoldRepeatController({
      onTick,
      schedule: (fn) => {
        const id = nextId;
        nextId += 1;
        queue.push({ id, fn });
        return id;
      },
      cancel: (id) => {
        const i = queue.findIndex((q) => q.id === id);
        if (i >= 0) queue.splice(i);
      },
    });
    ctrl.start();
    ctrl.stop();
    const pending = queue.slice();
    pending.forEach((j) => j.fn());
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
