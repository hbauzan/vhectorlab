/**
 * Custom Modal Component for confirmation dialogs and alerts.
 */
export class CustomModal {
  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'custom-modal-overlay';
    this.overlay.className = 'modal-overlay hidden';

    this.overlay.innerHTML = `
      <div class="modal-card glass-modal">
        <div class="modal-header">
          <h3 id="modal-title">NOTICE</h3>
          <button id="modal-close" class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p id="modal-message"></p>
        </div>
        <div class="modal-footer">
          <button id="modal-ok-btn" class="btn-secondary">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.titleEl = this.overlay.querySelector('#modal-title');
    this.msgEl = this.overlay.querySelector('#modal-message');
    
    this.overlay.querySelector('#modal-close').addEventListener('click', () => this.hide());
    this.overlay.querySelector('#modal-ok-btn').addEventListener('click', () => this.hide());
  }

  show(title, message) {
    this.titleEl.textContent = title;
    this.msgEl.textContent = message;
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }
}
