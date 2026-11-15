import type { GameModule } from '../types';

// Space Defender runs as its own page (space-defender.html) in a frame, so its page-wide styles,
// key handlers and game loop stay out of the hub and are all gone when the frame is removed.
const game: GameModule = {
  mount(root, { onExit }) {
    const frame = document.createElement('iframe');
    frame.src = './space-defender.html';
    frame.title = 'Space Defender';
    frame.allow = 'autoplay; fullscreen';
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#05060f';
    root.appendChild(frame);
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.contentWindow && (e.data as { type?: string } | null)?.type === 'games:exit') onExit();
    };
    addEventListener('message', onMsg);
    frame.addEventListener('load', () => frame.contentWindow?.focus());
    return () => {
      removeEventListener('message', onMsg);
      frame.remove();
    };
  },
};
export default game;
