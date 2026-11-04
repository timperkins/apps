// The "play on another device" card: a QR code and room code for the second device.
import QRCode from 'qrcode';
import { joinUrl, type OnlineHost } from '../net/online';

export class InviteCard {
  readonly el: HTMLDivElement;
  private status: HTMLElement;

  constructor(private host: OnlineHost) {
    this.el = document.createElement('div');
    this.el.className = 'invite';
    this.el.innerHTML = `
      <div class="card">
        <button class="close" type="button" aria-label="Close">✕</button>
        <h2>Play on another device</h2>
        <p>Scan this with a phone or tablet to join as player 2.</p>
        <div class="qr"><span>Making a room…</span></div>
        <p class="code"></p>
        <p class="status"></p>
      </div>`;
    this.status = this.el.querySelector('.status')!;
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  async show() {
    document.body.appendChild(this.el);
    this.refresh();
    if (this.host.code) return;
    try {
      const code = await this.host.open();
      const url = joinUrl(code);
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, url, { width: 220, margin: 1, color: { dark: '#3b2f2f', light: '#ffffff' } });
      this.el.querySelector('.qr')!.replaceChildren(canvas);
      const codeEl = this.el.querySelector('.code')!;
      codeEl.innerHTML = `Or open <b></b> and type the code <b class="big"></b>`;
      codeEl.querySelector('b')!.textContent = `${location.host}${location.pathname}`.replace(/\/$/, '');
      codeEl.querySelector('.big')!.textContent = code;
      this.refresh();
    } catch (err) {
      console.error(err);
      this.el.querySelector('.qr')!.textContent = "Couldn't make a room. Check the internet connection and try again.";
    }
  }

  refresh() {
    this.status.textContent = this.host.connected ? '✅ Player 2 is here!' : this.host.code ? 'Waiting for player 2…' : '';
  }

  hide() {
    this.el.remove();
  }
}
