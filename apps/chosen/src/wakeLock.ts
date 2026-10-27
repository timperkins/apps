// Keeps the screen awake during a round. Silently does nothing where unsupported.

let sentinel: WakeLockSentinel | null = null
let pending = false

export function acquire(): void {
  if (sentinel || pending || !('wakeLock' in navigator)) return
  pending = true
  navigator.wakeLock
    .request('screen')
    .then((s) => {
      sentinel = s
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null
      })
    })
    .catch(() => {})
    .finally(() => {
      pending = false
    })
}

export function release(): void {
  void sentinel?.release().catch(() => {})
  sentinel = null
}
