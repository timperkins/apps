# Bad Guys and Good Guys

A co-op 3D street brawler for phones and computers. Kids fight their way from the school steps to the park on the last day of school, past fed-up grown-ups who throw burgers, dodgeballs and garden gnomes.

- 1 to 4 players. The host's browser runs the game; friends join with a 4-digit code or QR code over peer-to-peer (PeerJS only brokers the handshake).
- Character creator: build, skin, hair, face, top, bottom, shoes, hat and back item.
- One level in five stretches, ending with Principal Grimsby.
- Pick up weapons (swing or throw), eat snacks to heal, walk over to a knocked-out friend to revive them.

## Controls

- Keyboard: WASD or arrows to move, J / Z / Space to attack, K / X to jump, L / C / E to grab or throw.
- Gamepad: stick or d-pad, X/B attack, A jump, Y grab.
- Touch: joystick on the left, buttons on the right.

## Code

- `src/core` — the game itself, no rendering or networking (tested in `tests/`).
- `src/net` — PeerJS transport and the host/guest sessions.
- `src/render` — three.js scene, characters, props and animation.
- `src/ui` — character creator, HUD and controls.

Test hooks: `?fixedstep` advances the game a fixed step per frame (for slow headless browsers), and `?peerhost=127.0.0.1:9000` uses a local PeerJS server.

```
npm run dev
npm run typecheck && npm test && npm run build
```
