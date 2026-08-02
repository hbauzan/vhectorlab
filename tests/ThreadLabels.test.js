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
      contains: (cls) => classList.has(cls)
    },
    style: {},
    appendChild: (child) => children.push(child),
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

  it('debe inicializar el contenedor overlay de etiquetas', () => {
    const overlay = container.querySelector('#thread-labels-container');
    expect(overlay).not.toBeNull();
  });

  it('debe registrar tarjetas de etiquetas para cada hilo', () => {
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

  it('debe limpiar las etiquetas registradas', () => {
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

  it('debe actualizar origins in-situ durante tween de reorder', () => {
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
});
