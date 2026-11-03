// Entry point. A phone that scanned a co-op QR code (?join=CODE) gets the controller;
// anything else gets the game.
import { normalizeCode } from './coop/net';

const join = new URLSearchParams(location.search).get('join');
if (join) void import('./coop/controller').then(m => m.runController(normalizeCode(join)));
else void import('./main');
