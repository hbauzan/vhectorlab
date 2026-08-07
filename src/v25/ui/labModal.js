/**
 * Minimal lab modal for v25 alerts (EN copy).
 */

export function createLabModal(doc = document) {
  const overlay = doc.createElement('div');
  overlay.className = 'lab-modal-overlay is-hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="lab-modal lab-panel">
      <header class="lab-modal__header">
        <h3 class="lab-modal__title" id="lab-modal-title">NOTICE</h3>
        <button type="button" class="lab-modal__close" aria-label="Close">&times;</button>
      </header>
      <div class="lab-modal__body">
        <p class="lab-modal__message" id="lab-modal-message"></p>
      </div>
      <footer class="lab-modal__footer">
        <button type="button" class="lab-btn lab-btn--primary lab-modal__ok">OK</button>
      </footer>
    </div>
  `;

  const titleEl = overlay.querySelector('#lab-modal-title');
  const msgEl = overlay.querySelector('#lab-modal-message');
  const hide = () => overlay.classList.add('is-hidden');
  const show = (title, message) => {
    if (titleEl) titleEl.textContent = title || 'NOTICE';
    if (msgEl) msgEl.textContent = message || '';
    overlay.classList.remove('is-hidden');
  };

  overlay.querySelector('.lab-modal__close')?.addEventListener('click', hide);
  overlay.querySelector('.lab-modal__ok')?.addEventListener('click', hide);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide();
  });

  doc.body.appendChild(overlay);

  return { show, hide, element: overlay };
}
