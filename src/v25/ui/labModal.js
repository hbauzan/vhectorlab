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
        <button type="button" class="lab-btn lab-btn--ghost lab-modal__cancel is-hidden">Cancel</button>
        <button type="button" class="lab-btn lab-btn--primary lab-modal__ok">OK</button>
      </footer>
    </div>
  `;

  const titleEl = overlay.querySelector('#lab-modal-title');
  const msgEl = overlay.querySelector('#lab-modal-message');
  const okBtn = overlay.querySelector('.lab-modal__ok');
  const cancelBtn = overlay.querySelector('.lab-modal__cancel');
  /** @type {((v: boolean) => void)|null} */
  let pendingResolve = null;

  const hide = () => {
    overlay.classList.add('is-hidden');
    cancelBtn?.classList.add('is-hidden');
    if (okBtn) okBtn.textContent = 'OK';
  };

  const finish = (value) => {
    const resolve = pendingResolve;
    pendingResolve = null;
    hide();
    if (resolve) resolve(value);
  };

  const show = (title, message) => {
    pendingResolve = null;
    cancelBtn?.classList.add('is-hidden');
    if (okBtn) okBtn.textContent = 'OK';
    if (titleEl) titleEl.textContent = title || 'NOTICE';
    if (msgEl) msgEl.textContent = message || '';
    overlay.classList.remove('is-hidden');
  };

  /**
   * @param {string} title
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  const confirm = (title, message) =>
    new Promise((resolve) => {
      pendingResolve = resolve;
      cancelBtn?.classList.remove('is-hidden');
      if (okBtn) okBtn.textContent = 'Confirm';
      if (titleEl) titleEl.textContent = title || 'CONFIRM';
      if (msgEl) msgEl.textContent = message || '';
      overlay.classList.remove('is-hidden');
    });

  overlay.querySelector('.lab-modal__close')?.addEventListener('click', () => finish(false));
  okBtn?.addEventListener('click', () => finish(true));
  cancelBtn?.addEventListener('click', () => finish(false));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish(false);
  });

  doc.body.appendChild(overlay);

  return { show, hide, confirm, element: overlay };
}
