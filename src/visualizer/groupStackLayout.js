/**
 * ANALYSIS Y-stack slots with optional soft gap between GROUP_* blocks (D5).
 */

/**
 * Distinct non-empty groupId values in item order.
 * @param {Array<{ groupId?: string }|null|undefined>|null|undefined} items
 * @returns {string[]}
 */
export function listDistinctGroupIds(items) {
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const it of items || []) {
    const id = it?.groupId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @param {Array<{ groupId?: string }|null|undefined>|null|undefined} items
 * @returns {number}
 */
export function countDistinctGroups(items) {
  return listDistinctGroupIds(items).length;
}

/**
 * Y slot indices for ANALYSIS stacking. When consecutive items have different
 * non-empty groupIds, insert `gapSlots` empty slots between them (+1× spacing).
 *
 * @param {Array<{ groupId?: string }|null|undefined>|null|undefined} items
 * @param {{ gapSlots?: number }} [opts]
 * @returns {{ slots: number[], span: number }}
 */
export function computeGroupAwareYSlots(items, opts = {}) {
  const list = Array.isArray(items) ? items : [];
  const gapSlots = Number.isFinite(opts.gapSlots) ? Math.max(0, Math.floor(opts.gapSlots)) : 1;

  /** @type {number[]} */
  const slots = [];
  let slot = 0;
  let prevGroup = /** @type {string|null} */ (null);

  for (let i = 0; i < list.length; i++) {
    const cur = list[i]?.groupId || null;
    if (i > 0 && prevGroup && cur && prevGroup !== cur) {
      slot += gapSlots;
    }
    slots.push(slot);
    prevGroup = cur;
    slot += 1;
  }

  const maxSlot = slots.length ? slots[slots.length - 1] : 0;
  return { slots, span: maxSlot };
}
