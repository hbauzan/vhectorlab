/**
 * Custom Modal Component for confirmation dialogs and alerts.
 */
export class CustomModal {
  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'custom-modal-overlay';
    this.overlay.className = 'modal-overlay hidden';
    /** @type {((ok: boolean) => void)|null} */
    this._resolveConfirm = null;

    this.overlay.innerHTML = `
      <div class="modal-card glass-modal">
        <div class="modal-header">
          <h3 id="modal-title">NOTICE</h3>
          <button id="modal-close" class="modal-close-btn" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <p id="modal-message"></p>
        </div>
        <div class="modal-footer">
          <button id="modal-cancel-btn" class="btn-secondary hidden" type="button" hidden>Cancel</button>
          <button id="modal-ok-btn" class="btn-secondary" type="button">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.titleEl = this.overlay.querySelector('#modal-title');
    this.msgEl = this.overlay.querySelector('#modal-message');
    this.okBtn = this.overlay.querySelector('#modal-ok-btn');
    this.cancelBtn = this.overlay.querySelector('#modal-cancel-btn');

    this.overlay.querySelector('#modal-close').addEventListener('click', () => {
      this._finishConfirm(false);
      this.hide();
    });
    this.okBtn.addEventListener('click', () => {
      this._finishConfirm(true);
      this.hide();
    });
    this.cancelBtn.addEventListener('click', () => {
      this._finishConfirm(false);
      this.hide();
    });
  }

  _finishConfirm(ok) {
    if (this._resolveConfirm) {
      const resolve = this._resolveConfirm;
      this._resolveConfirm = null;
      resolve(ok);
    }
  }

  /**
   * Alert-style modal (single OK).
   * @param {string} title
   * @param {string} message
   */
  show(title, message) {
    this._resolveConfirm = null;
    this.titleEl.textContent = title;
    this.msgEl.textContent = message;
    this.cancelBtn.setAttribute('hidden', '');
    this.cancelBtn.classList.add('hidden');
    this.okBtn.textContent = 'OK';
    this.overlay.classList.remove('hidden');
  }

  /**
   * Confirm dialog. Resolves true on confirm, false on cancel/close.
   * @param {string} title
   * @param {string} message
   * @param {{ confirmLabel?: string, cancelLabel?: string }} [opts]
   * @returns {Promise<boolean>}
   */
  confirm(title, message, opts = {}) {
    return new Promise((resolve) => {
      this._resolveConfirm = resolve;
      this.titleEl.textContent = title;
      this.msgEl.textContent = message;
      this.cancelBtn.removeAttribute('hidden');
      this.cancelBtn.classList.remove('hidden');
      this.cancelBtn.textContent = opts.cancelLabel || 'Cancel';
      this.okBtn.textContent = opts.confirmLabel || 'Confirm';
      this.overlay.classList.remove('hidden');
    });
  }

  hide() {
    this.overlay.classList.add('hidden');
    this.cancelBtn.setAttribute('hidden', '');
    this.cancelBtn.classList.add('hidden');
    this.okBtn.textContent = 'OK';
  }
}
