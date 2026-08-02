import * as THREE from 'three';
import { GROUP_LABEL_SCREEN_OFFSET_X } from './parseCompareGroups.js';

/**
 * Manages floating 2D Glassmorphic Thread Label Badges over 3D WebGL origins.
 */
export class ThreadLabels {
  constructor(containerElement) {
    this.container = containerElement || (typeof document !== 'undefined' ? document.body : null);
    this.visible = true;
    if (typeof document !== 'undefined') {
      this.overlay = document.createElement('div');
      this.overlay.id = 'thread-labels-container';
      if (this.container) {
        this.container.appendChild(this.overlay);
      }
    }

    this.labels = []; // Array of { id, text, type, origin3D, element, screenOffsetX, groupId, groupLabel }
    this.tempVector = new THREE.Vector3();
  }

  /**
   * Show or hide the floating labels overlay (DOM stays mounted).
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.visible = visible !== false;
    if (!this.overlay) return;
    if (this.visible) {
      this.overlay.classList.remove('is-hidden');
      this.overlay.removeAttribute('aria-hidden');
    } else {
      this.overlay.classList.add('is-hidden');
      this.overlay.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * @returns {boolean}
   */
  isVisible() {
    return this.visible !== false;
  }

  /**
   * Sets active thread labels with 3D origins and descriptions.
   * @param {Array<{ id: string, text: string, type: string, origin3D: THREE.Vector3, groupId?: string, groupLabel?: string }>} labelItems
   */
  setLabels(labelItems) {
    this.clear();
    if (!labelItems || !Array.isArray(labelItems)) return;

    labelItems.forEach((item) => {
      let card = null;
      if (typeof document !== 'undefined') {
        card = document.createElement('div');
        const isRes = item.type === 'res' || item.type === 'result';
        const isTop1 = item.type === 'top_1' || item.type === 'top1';
        const isGroup = item.type === 'group';
        card.className = [
          'thread-label-card',
          isRes ? 'res-label' : '',
          isTop1 ? 'top1-label' : '',
          isGroup ? 'group-label' : '',
        ].filter(Boolean).join(' ');

        const labelText = document.createElement('span');
        labelText.className = 'thread-label-text';
        labelText.textContent = item.text;

        card.appendChild(labelText);
        if (this.overlay) {
          this.overlay.appendChild(card);
        }
      }

      this.labels.push({
        id: item.id,
        text: item.text,
        type: item.type,
        origin3D: item.origin3D.clone(),
        element: card,
        screenOffsetX: item.type === 'group' ? GROUP_LABEL_SCREEN_OFFSET_X : 0,
        groupId: item.groupId,
        groupLabel: item.groupLabel,
      });
    });
  }

  clear() {
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
    this.labels = [];
  }

  /**
   * Update 3D origins in-place (keeps DOM cards) — used during compare reorder tweens.
   * @param {Array<{ id: string, origin3D: THREE.Vector3, text?: string }>} labelItems
   */
  updateOrigins(labelItems) {
    if (!labelItems || !this.labels.length) return;
    const byId = new Map(labelItems.map((item) => [item.id, item]));
    this.labels.forEach((label) => {
      const next = byId.get(label.id);
      if (!next || !next.origin3D) return;
      label.origin3D.copy(next.origin3D);
      if (next.text != null && next.text !== label.text) {
        label.text = next.text;
        if (label.element) {
          const textEl = label.element.querySelector('.thread-label-text');
          if (textEl) textEl.textContent = next.text;
        }
      }
    });
  }

  /**
   * Updates positions of floating 2D labels based on camera projection.
   * @param {THREE.Camera} camera
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  update(camera, width, height) {
    if (!this.visible || !this.labels.length || !camera) return;

    this.labels.forEach((item) => {
      this.tempVector.copy(item.origin3D);
      this.tempVector.project(camera);

      // Check if origin is behind camera (Z > 1 in NDC)
      if (this.tempVector.z > 1.0) {
        if (item.element) item.element.style.display = 'none';
        return;
      }

      if (item.element) {
        item.element.style.display = 'flex';
        // Convert NDC (-1 to +1) to screen pixels; tokens -15px, groups further left.
        const extraLeft = item.screenOffsetX || 0;
        const x = ((this.tempVector.x + 1) * width) / 2 - 15 - extraLeft;
        const y = ((-this.tempVector.y + 1) * height) / 2;

        item.element.style.left = `${x}px`;
        item.element.style.top = `${y}px`;
      }
    });
  }
}
