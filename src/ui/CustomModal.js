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
      <div class="custom-modal amiga-window" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="amiga-window-titlebar">
          <button type="button" id="modal-close" class="amiga-window-gadget" data-gadget="close" aria-label="Close">
            <span class="gadget-inner-square" aria-hidden="true"></span>
          </button>
          <span class="amiga-window-title" id="modal-title">NOTICE</span>
          <button type="button" id="modal-depth" class="amiga-window-gadget" data-gadget="depth" aria-label="Window depth">
            <span class="gadget-inner-square" aria-hidden="true"></span>
          </button>
        </div>
        <div class="custom-modal-frame">
          <p id="modal-message"></p>
          <div class="modal-footer">
            <button id="modal-cancel-btn" class="amiga-gadget-btn hidden" type="button" hidden>Cancel</button>
            <button id="modal-ok-btn" class="amiga-gadget-btn" type="button">OK</button>
          </div>
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
