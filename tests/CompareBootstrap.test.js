import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  COMPARE_AUTO_PRESETS,
  getCompareBootstrap,
} from '../src/ui/ComparePanel.js';
import {
  attachCompareGroupMeta,
  mergeCompareOverlayLabels,
} from '../src/ui/parseCompareGroups.js';

/**
 * Regression: textarea default was groupsDemo but COMPARE entry auto-loaded
 * flat `default` (136 tokens, no groupId) → overlay showed token names forever.
 */
describe('COMPARE bootstrap ↔ GROUP overlay contract', () => {
  it('bootstrap is grouped and matches groupsDemo token count', () => {
    const boot = getCompareBootstrap();
    expect(boot.mode).toBe('grouped');
    expect(boot.tokens.length).toBe(130);
    expect(boot.tokenMeta[0].groupId).toBe('GROUP_1');
    expect(boot.tokenMeta[65].groupId).toBe('GROUP_2');
    expect(boot.textareaValue).toBe(COMPARE_AUTO_PRESETS.groupsDemo);
  });

  it('bootstrap + attach meta → overlay shows only GROUP_1 / GROUP_2', () => {
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
    expect(overlay).toHaveLength(2);
    expect(overlay.map((l) => l.text)).toEqual(['GROUP_1', 'GROUP_2']);
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
