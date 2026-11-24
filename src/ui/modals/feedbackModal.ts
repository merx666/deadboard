import { type FeedbackContext, mountFeedbackForm } from '../feedback';
import { icon } from '../icons';

export interface FeedbackModalContext {
  getModalPos: () => [number, number];
  modalRootEl: HTMLElement;
  getFeedbackContext: () => FeedbackContext;
  onClose: () => void;
  isSuppressModalBgClose: () => boolean;
  resetSuppressModalBgClose: () => void;
}

export class FeedbackModalController {
  constructor(private ctx: FeedbackModalContext) {}

  public open() {
    this.render();
  }

  public render() {
    const modalPos = this.ctx.getModalPos();
    this.ctx.modalRootEl.innerHTML = `
      <div class="modal-backdrop" id="fb-close-bg">
        <div class="modal" style="transform: translate3d(${modalPos[0]}px, ${modalPos[1]}px, 0)">
          <div class="modal-head" title="Drag to move window">
            <h2>Feedback</h2>
            <button class="btn ghost icon sm" id="fb-close" title="Close">${icon('x', 14)}</button>
          </div>
          <div class="card"><div id="fb-host"></div></div>
        </div>
      </div>`;
    mountFeedbackForm(this.ctx.modalRootEl.querySelector<HTMLElement>('#fb-host')!, () => this.ctx.getFeedbackContext());
    this.ctx.modalRootEl.querySelector('#fb-close')?.addEventListener('click', () => this.ctx.onClose());
    this.ctx.modalRootEl.querySelector('#fb-close-bg')?.addEventListener('click', (e) => {
      if (this.ctx.isSuppressModalBgClose()) {
        this.ctx.resetSuppressModalBgClose();
        return;
      }
      if ((e.target as HTMLElement).id === 'fb-close-bg') this.ctx.onClose();
    });
  }
}
