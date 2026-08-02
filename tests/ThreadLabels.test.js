import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ThreadLabels } from '../src/ui/ThreadLabels.js';

// Lightweight mock for document & DOM elements in Node environment
function createMockElement(tagName = 'div') {
  const children = [];
  const classList = new Set();
  let _className = '';

  const element = {
    tagName: tagName.toUpperCase(),
    children,
    classList: {
      add: (cls) => { classList.add(cls); _className = Array.from(classList).join(' '); },
      remove: (cls) => { classList.delete(cls); _className = Array.from(classList).join(' '); },
      contains: (cls) => classList.has(cls),
      toggle: (cls, force) => {
        const shouldHave = force === undefined ? !classList.has(cls) : !!force;
        if (shouldHave) classList.add(cls); else classList.delete(cls);
        _className = Array.from(classList).join(' ');
        return shouldHave;
      },
    },
    style: {},
    appendChild: (child) => children.push(child),
    setAttribute: () => {},
    removeAttribute: () => {},
    querySelector: (selector) => {
      const cleanSel = selector.replace('#', '').replace('.', '');
      for (const child of children) {
        if (child.id === cleanSel || child.classList.contains(cleanSel)) return child;
        const found = child.querySelector ? child.querySelector(selector) : null;
        if (found) return found;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      const cleanSel = selector.replace('#', '').replace('.', '');
      let results = [];
      for (const child of children) {
        if (child.classList.contains(cleanSel)) results.push(child);
        if (child.querySelectorAll) results = results.concat(child.querySelectorAll(selector));
      }
      return results;
    },
    set innerHTML(val) {
      if (val === '') children.length = 0;
    },
    set className(val) {
      _className = val;
      val.split(' ').forEach(c => { if (c) classList.add(c); });
    },
    get className() {
      return _className;
    },
    id: '',
    textContent: ''
  };
  return element;
}

if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tagName) => createMockElement(tagName),
    body: createMockElement('body')
  };
}

describe('ThreadLabels Component Tests', () => {
  let container;
  let threadLabels;

  beforeEach(() => {
    container = document.createElement('div');
    threadLabels = new ThreadLabels(container);
  });

  it('initializes the labels overlay container', () => {
    const overlay = container.querySelector('#thread-labels-container');
    expect(overlay).not.toBeNull();
  });

  it('registers label cards for each thread', () => {
    const mockItems = [
      { id: 'vec_a', text: 'KING', type: 'word_a', origin3D: new THREE.Vector3(0, 50, 0) },
      { id: 'res', text: 'RESULT', type: 'res', origin3D: new THREE.Vector3(0, -50, 0) }
    ];

    threadLabels.setLabels(mockItems);

    expect(threadLabels.labels.length).toBe(2);
    const cards = container.querySelectorAll('.thread-label-card');
    expect(cards.length).toBe(2);
    expect(cards[1].classList.contains('res-label')).toBe(true);
  });

  it('clears registered labels', () => {
    const mockItems = [
      { id: 'vec_a', text: 'KING', type: 'word_a', origin3D: new THREE.Vector3(0, 50, 0) }
    ];

    threadLabels.setLabels(mockItems);
    expect(threadLabels.labels.length).toBe(1);

    threadLabels.clear();
    expect(threadLabels.labels.length).toBe(0);
    const cards = container.querySelectorAll('.thread-label-card');
    expect(cards.length).toBe(0);
  });

  it('updates origins in-place during reorder tween', () => {
    threadLabels.setLabels([
      { id: 'tok_0', text: 'king', type: 'compare', origin3D: new THREE.Vector3(0, 10, 0) },
      { id: 'tok_1', text: 'queen', type: 'compare', origin3D: new THREE.Vector3(0, 0, 0) },
    ]);

    threadLabels.updateOrigins([
      { id: 'tok_0', origin3D: new THREE.Vector3(0, 0, 0) },
      { id: 'tok_1', origin3D: new THREE.Vector3(0, 10, 0) },
    ]);

    expect(threadLabels.labels[0].origin3D.y).toBe(0);
    expect(threadLabels.labels[1].origin3D.y).toBe(10);
    expect(threadLabels.labels.length).toBe(2);
  });

  it('registers group-label cards with distinct class', () => {
    threadLabels.setLabels([
      { id: 'group:G1', text: 'GROUP_1', type: 'group', origin3D: new THREE.Vector3(0, 5, 0) },
      { id: 'tok_0', text: 'car', type: 'compare', origin3D: new THREE.Vector3(0, 10, 0) },
    ]);
    expect(threadLabels.labels[0].screenOffsetX).toBeGreaterThan(0);
    expect(threadLabels.labels[1].screenOffsetX).toBe(0);
    const cards = container.querySelectorAll('.thread-label-card');
    expect(cards[0].classList.contains('group-label')).toBe(true);
  });

  it('rebuilds DOM when updateOrigins switches tokens → group badges', () => {
    threadLabels.setLabels([
      { id: 'tok_0', text: 'car', type: 'compare', origin3D: new THREE.Vector3(0, 10, 0) },
      { id: 'tok_1', text: 'grace', type: 'compare', origin3D: new THREE.Vector3(0, -10, 0) },
    ]);
    expect(threadLabels.labels).toHaveLength(2);

    threadLabels.updateOrigins([
      { id: 'group:GROUP_1', text: 'GROUP_1', type: 'group', origin3D: new THREE.Vector3(0, 5, 0) },
      { id: 'group:GROUP_2', text: 'GROUP_2', type: 'group', origin3D: new THREE.Vector3(0, -5, 0) },
    ]);
    expect(threadLabels.labels).toHaveLength(2);
    expect(threadLabels.labels[0].id).toBe('group:GROUP_1');
    expect(threadLabels.labels[0].type).toBe('group');
    const cards = container.querySelectorAll('.thread-label-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].classList.contains('group-label')).toBe(true);
  });

  it('hides and shows the overlay via setVisible', () => {
    threadLabels.setVisible(false);
    expect(threadLabels.isVisible()).toBe(false);
    const overlay = container.querySelector('#thread-labels-container');
    expect(overlay.classList.contains('is-hidden')).toBe(true);

    threadLabels.setVisible(true);
    expect(threadLabels.isVisible()).toBe(true);
    expect(overlay.classList.contains('is-hidden')).toBe(false);
  });
});
