import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  COMPARE_AUTO_PRESETS,
  COMPARE_GALAXY_BOOTSTRAP_TEXT,
  COMPARE_GROUPS_DEMO_TEXT,
  WOMEN_GROUP_ID,
  VEHICLES_GROUP_ID,
  getCompareBootstrap,
} from '../src/ui/ComparePanel.js';
import {
  assertItCoreCorpus,
  IT_CORE_GROUP_ID,
  IT_CORE_TOKENS,
} from '../src/ui/itCoreCorpus.js';
import {
  attachCompareGroupMeta,
  mergeCompareOverlayLabels,
  parseCompareInput,
} from '../src/ui/parseCompareGroups.js';

describe('IT core corpus fixture', () => {
  it('has exactly 100 unique tokens', () => {
    const { length, unique } = assertItCoreCorpus();
    expect(length).toBe(100);
    expect(unique).toBe(true);
    expect(IT_CORE_TOKENS[0]).toBe('server');
    expect(IT_CORE_TOKENS[99]).toBe('encryption');
  });
});

/**
 * Bootstrap = it_core (100) + vehicles + women; REF inside IT core.
 */
describe('COMPARE bootstrap ↔ GROUP overlay contract', () => {
  it('bootstrap is 3 groups with it_core first', () => {
    const boot = getCompareBootstrap();
    expect(boot.mode).toBe('grouped');
    expect(boot.textareaValue).toBe(COMPARE_GALAXY_BOOTSTRAP_TEXT);
    expect(boot.textareaValue).toBe(COMPARE_AUTO_PRESETS.galaxyDemo);
    expect(boot.groups.map((g) => g.id)).toEqual([
      IT_CORE_GROUP_ID,
      VEHICLES_GROUP_ID,
      WOMEN_GROUP_ID,
    ]);
    expect(boot.groups[0].tokens).toHaveLength(100);
    expect(boot.tokenMeta[0].groupId).toBe(IT_CORE_GROUP_ID);
    expect(boot.tokens[0]).toBe('server');

    const g1Start = 100;
    const g2Start = 100 + boot.groups[1].tokens.length;
    expect(boot.tokenMeta[g1Start].groupId).toBe(VEHICLES_GROUP_ID);
    expect(boot.tokenMeta[g2Start].groupId).toBe(WOMEN_GROUP_ID);
    expect(boot.tokens.length).toBe(
      100 + boot.groups[1].tokens.length + boot.groups[2].tokens.length,
    );
    expect(boot.tokens.length).toBe(230);
  });

  it('2 Groups preset remains vehicles + women only (130)', () => {
    const parsed = parseCompareInput(COMPARE_GROUPS_DEMO_TEXT);
    expect(parsed.tokens).toHaveLength(130);
    expect(parsed.groups.map((g) => g.id)).toEqual([
      VEHICLES_GROUP_ID,
      WOMEN_GROUP_ID,
    ]);
    expect(COMPARE_AUTO_PRESETS.groupsDemo).toBe(COMPARE_GROUPS_DEMO_TEXT);
  });

  it('bootstrap + attach meta → overlay shows it_core / vehicles / women', () => {
    const boot = getCompareBootstrap();
    const data = {
      count: boot.tokens.length,
      items: boot.tokens.map((text, i) => ({
        id: `tok_${i}`,
        index: i,
        text,
        embedding: [0.1, -0.1],
      })),
    };
    const withMeta = attachCompareGroupMeta(data, boot.tokenMeta);
    const labels = withMeta.items.map((item, i) => ({
      id: item.id,
      text: item.text,
      type: 'compare',
      origin3D: new THREE.Vector3(0, -i, 0),
      groupId: item.groupId,
      groupLabel: item.groupLabel,
    }));
    const overlay = mergeCompareOverlayLabels(labels);
    expect(overlay).toHaveLength(3);
    expect(overlay.map((l) => l.text)).toEqual([
      IT_CORE_GROUP_ID,
      VEHICLES_GROUP_ID,
      WOMEN_GROUP_ID,
    ]);
    expect(overlay.every((l) => l.type === 'group')).toBe(true);
  });

  it('flat default (old autoload) never yields group badges', () => {
    const tokens = COMPARE_AUTO_PRESETS.default;
    expect(tokens).toHaveLength(136);
    const labels = tokens.map((text, i) => ({
      id: `tok_${i}`,
      text,
      type: 'compare',
      origin3D: new THREE.Vector3(0, -i, 0),
    }));
    const overlay = mergeCompareOverlayLabels(labels);
    expect(overlay.length).toBe(136);
    expect(overlay.every((l) => l.type === 'compare')).toBe(true);
  });
});
