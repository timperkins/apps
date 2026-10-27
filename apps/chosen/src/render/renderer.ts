import { fingerColor } from '../game/colors'
import { FADE_OUT_MS, type Finger, type Game, type Phase } from '../game/machine'
import { easeOutBack, easeOutCubic, easeOutElastic, clamp, mixColor, withAlpha } from './easing'

const BG_TOP = '#1a0b2e'
const BG_BOTTOM = '#3a1260'
const LOSER_GREY = '#6b6480'
const TAUNT_DELAY_MS = 900
const TAUNT_STAGGER_MS = 300
const APPEAR_MS = 350
const DEPART_MS = 220

/** Where the start screen's ghost rings sit, as fractions of the screen; clear of the centered text. */
const GHOST_RINGS = [
  { x: 0.22, y: 0.18 },
  { x: 0.78, y: 0.26 },
  { x: 0.18, y: 0.76 },
  { x: 0.8, y: 0.82 },
  { x: 0.5, y: 0.92 },
]

interface Departing {
  x: number
  y: number
  color: number
  leftAt: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  size: number
  color: string
}

interface TauntLayout {
  fingerId: number
  message: string
  bx: number
  by: number
  w: number
  h: number
  tilt: number
  fontSize: number
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private lastNow = 0
  private readonly known = new Map<number, Finger>()
  private departing: Departing[] = []
  private particles: Particle[] = []
  private lastPhase: Phase = 'idle'
  private confettiRound = -1
  private layoutRound = -1
  private taunts: TauntLayout[] = []
  private readonly reducedMotion: boolean

  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not supported')
    this.ctx = ctx
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    this.w = window.innerWidth
    this.h = window.innerHeight
    this.canvas.width = Math.round(this.w * dpr)
    this.canvas.height = Math.round(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.layoutRound = -1
  }

  /** Ring radius in CSS pixels, scaled down a little on tiny screens. */
  private get radius(): number {
    return clamp(Math.min(this.w, this.h) * 0.12, 34, 52)
  }

  draw(game: Game, now: number): void {
    const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000)
    this.lastNow = now
    const { ctx } = this
    this.trackDepartures(game, now)

    const bg = ctx.createLinearGradient(0, 0, 0, this.h)
    bg.addColorStop(0, BG_TOP)
    bg.addColorStop(1, BG_BOTTOM)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, this.w, this.h)

    const fade = game.phase === 'fading' ? 1 - clamp((now - game.fadeStart) / FADE_OUT_MS, 0, 1) : 1
    ctx.save()
    ctx.globalAlpha = fade

    if (game.result) this.drawResult(game, now, dt)
    else this.drawPlaying(game, now)

    ctx.restore()

    if (game.phase === 'idle' && game.fingers.size === 0) this.drawZeroState(now)
  }

  private trackDepartures(game: Game, now: number): void {
    // Only fingers lifted mid-game fade out; a finished round clears all at once.
    const live = this.lastPhase === 'idle' || this.lastPhase === 'counting'
    for (const [id, f] of this.known) {
      if (game.fingers.has(id)) continue
      if (live) this.departing.push({ x: f.x, y: f.y, color: f.color, leftAt: now })
      this.known.delete(id)
    }
    for (const [id, f] of game.fingers) this.known.set(id, { ...f })
    this.departing = this.departing.filter((d) => now - d.leftAt < DEPART_MS)
    this.lastPhase = game.phase
  }

  private drawPlaying(game: Game, now: number): void {
    const r = this.radius
    for (const d of this.departing) {
      const k = clamp((now - d.leftAt) / DEPART_MS, 0, 1)
      this.ring(d.x, d.y, r * (1 - 0.5 * k), fingerColor(d.color), 1 - k)
    }

    const counting = game.phase === 'counting'
    const t = (now - game.countdownStart) / 1000
    // One slow pulse per second.
    const phase = 2 * Math.PI * t
    const pulseAmp = this.reducedMotion ? 0.03 : 0.1
    const sinceRestart = now - game.lastRestartAt
    const shake = !this.reducedMotion && sinceRestart < 350 ? Math.sin(sinceRestart / 18) * 9 * (1 - sinceRestart / 350) : 0
    const progress = game.progress(now)

    for (const f of game.fingers.values()) {
      const color = fingerColor(f.color)
      const appear = easeOutBack(clamp((now - f.joinedAt) / APPEAR_MS, 0, 1))
      const x = f.x + shake
      const y = f.y
      let scale = appear
      if (counting) {
        scale *= 1 + pulseAmp * Math.sin(phase)
        // Ripple that rides out from the ring on every beat.
        const frac = (phase / (2 * Math.PI)) % 1
        this.ring(x, y, r * (1 + 0.7 * frac), color, 0.5 * (1 - frac), 3)
      } else {
        scale *= 1 + 0.03 * Math.sin(now / 350)
      }
      this.disc(x, y, r * scale, color, 0.18)
      this.ring(x, y, r * scale, color, 1, 6)
      if (counting) this.arc(x, y, r * scale + 14, progress, color)
    }
  }

  private drawResult(game: Game, now: number, dt: number): void {
    const result = game.result!
    const ct = now - result.chosenAt
    const r = this.radius
    const winner = game.fingers.get(result.winnerId)
    if (!winner) return
    const wColor = fingerColor(winner.color)

    // Winner's color floods out from their finger.
    const flood = easeOutCubic(clamp(ct / 900, 0, 1))
    const far = Math.hypot(Math.max(winner.x, this.w - winner.x), Math.max(winner.y, this.h - winner.y))
    const grad = this.ctx.createRadialGradient(winner.x, winner.y, 0, winner.x, winner.y, Math.max(1, far * flood))
    grad.addColorStop(0, withAlpha(wColor, 0.45))
    grad.addColorStop(1, withAlpha(wColor, 0.08))
    this.ctx.fillStyle = grad
    this.ctx.beginPath()
    this.ctx.arc(winner.x, winner.y, Math.max(1, far * flood), 0, Math.PI * 2)
    this.ctx.fill()

    // Losers shrink and go grey.
    const lose = easeOutCubic(clamp(ct / 500, 0, 1))
    for (const f of game.fingers.values()) {
      if (f.id === result.winnerId) continue
      const color = mixColor(fingerColor(f.color), LOSER_GREY, lose * 0.85)
      const lr = r * (1 - 0.3 * lose)
      this.disc(f.x, f.y, lr, color, 0.12)
      this.ring(f.x, f.y, lr, color, 1, 5)
    }

    // Winner grows with a springy bounce, a spinning dashed halo and rays.
    const grow = this.reducedMotion ? easeOutCubic(clamp(ct / 500, 0, 1)) : easeOutElastic(clamp(ct / 1000, 0, 1))
    const wr = r * (1 + 0.55 * grow)
    this.drawRays(winner.x, winner.y, wr, wColor, ct)
    this.disc(winner.x, winner.y, wr, wColor, 0.4)
    this.ring(winner.x, winner.y, wr, wColor, 1, 9)
    const { ctx } = this
    ctx.save()
    ctx.setLineDash([14, 10])
    ctx.lineDashOffset = -ct / 18
    this.ring(winner.x, winner.y, wr + 18, '#ffffff', 0.9 * clamp(ct / 400, 0, 1), 4)
    ctx.restore()

    this.drawWinnerLabel(winner.x, winner.y, wr, ct)
    this.drawConfetti(game.round, winner, dt)
    this.drawTaunts(game, now, ct)
  }

  private drawRays(x: number, y: number, wr: number, color: string, ct: number): void {
    const { ctx } = this
    const n = 14
    const reveal = clamp(ct / 600, 0, 1)
    ctx.save()
    ctx.strokeStyle = withAlpha(color, 0.55 * reveal)
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ct / 1400
      const len = (22 + 14 * Math.sin(ct / 180 + i * 1.7)) * reveal
      const r0 = wr + 32
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0)
      ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len))
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawWinnerLabel(x: number, y: number, wr: number, ct: number): void {
    const { ctx } = this
    const pop = easeOutBack(clamp((ct - 250) / 450, 0, 1))
    if (pop <= 0) return
    const above = y - wr - 150 > 0
    const bob = this.reducedMotion ? 0 : Math.sin(ct / 260) * 5
    const textY = above ? y - wr - 52 + bob : y + wr + 58 + bob
    const label = 'You have been chosen'
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = 34
    ctx.font = titleFont(size)
    const fit = (this.w - 32) / ctx.measureText(label).width
    if (fit < 1) {
      size = Math.floor(size * fit)
      ctx.font = titleFont(size)
    }
    const half = ctx.measureText(label).width / 2 + 16
    ctx.translate(half * 2 < this.w ? clamp(x, half, this.w - half) : this.w / 2, 0)
    ctx.scale(pop, pop)
    ctx.lineWidth = 6
    ctx.strokeStyle = BG_TOP
    ctx.strokeText(label, 0, textY / pop)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, 0, textY / pop)
    ctx.restore()
  }

  private drawConfetti(round: number, winner: Finger, dt: number): void {
    if (this.reducedMotion) return
    if (this.confettiRound !== round) {
      this.confettiRound = round
      this.particles = Array.from({ length: 140 }, (_, i) => {
        const a = Math.random() * Math.PI * 2
        const speed = 250 + Math.random() * 650
        return {
          x: winner.x,
          y: winner.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 250,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 14,
          size: 6 + Math.random() * 7,
          color: fingerColor(i % 10),
        }
      })
    }
    const { ctx } = this
    for (const p of this.particles) {
      p.vy += 900 * dt
      p.vx *= 1 - 0.8 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt
      if (p.y > this.h + 40) continue
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
  }

  private drawTaunts(game: Game, now: number, ct: number): void {
    const result = game.result!
    if (this.layoutRound !== game.round) {
      this.taunts = this.layoutTaunts(game)
      this.layoutRound = game.round
    }
    const r = this.radius * 0.7
    const { ctx } = this
    this.taunts.forEach((t, i) => {
      const local = ct - TAUNT_DELAY_MS - i * TAUNT_STAGGER_MS
      if (local <= 0) return
      const f = game.fingers.get(t.fingerId)
      if (!f || !result) return

      // Wiggly hand-drawn arrow from the bubble to the loser's ring.
      const draw = clamp(local / 300, 0, 1)
      const dx = f.x - t.bx
      const dy = f.y - t.by
      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist
      const sx = t.bx + ux * (Math.min(t.w, t.h) / 2 + 6)
      const sy = t.by + uy * (Math.min(t.w, t.h) / 2 + 6)
      const ex = f.x - ux * (r + 14)
      const ey = f.y - uy * (r + 14)
      const wiggle = this.reducedMotion ? 0 : Math.sin(now / 140 + i) * 10
      const bend = 40 + wiggle
      const cx = (sx + ex) / 2 - uy * bend
      const cy = (sy + ey) / 2 + ux * bend
      const tipX = quad(sx, cx, ex, draw)
      const tipY = quad(sy, cy, ey, draw)
      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      const steps = 24
      for (let s = 1; s <= steps * draw; s++) {
        const k = s / steps
        ctx.lineTo(quad(sx, cx, ex, k), quad(sy, cy, ey, k))
      }
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      if (draw > 0.2) {
        const bx = quad(sx, cx, ex, draw - 0.05)
        const by = quad(sy, cy, ey, draw - 0.05)
        const a = Math.atan2(tipY - by, tipX - bx)
        ctx.beginPath()
        ctx.moveTo(tipX + Math.cos(a) * 6, tipY + Math.sin(a) * 6)
        ctx.lineTo(tipX + Math.cos(a + 2.5) * 20, tipY + Math.sin(a + 2.5) * 20)
        ctx.lineTo(tipX + Math.cos(a - 2.5) * 20, tipY + Math.sin(a - 2.5) * 20)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()

      // Speech bubble pops in.
      const pop = easeOutBack(clamp(local / 350, 0, 1))
      ctx.save()
      ctx.translate(t.bx, t.by)
      ctx.rotate(t.tilt + (this.reducedMotion ? 0 : Math.sin(now / 400 + i) * 0.03))
      ctx.scale(pop, pop)
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = 16
      ctx.shadowOffsetY = 4
      ctx.fillStyle = '#ffffff'
      roundRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h, t.h / 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = BG_TOP
      ctx.font = tauntFont(t.fontSize)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(t.message, 0, 1)
      ctx.restore()
    })
  }

  /** Place each bubble toward open space: in bounds, away from fingers and other bubbles. */
  private layoutTaunts(game: Game): TauntLayout[] {
    const result = game.result!
    const { ctx } = this
    const r = this.radius
    const margin = 12
    const placed: TauntLayout[] = []
    const fingers = [...game.fingers.values()]
    for (const taunt of result.taunts) {
      const f = game.fingers.get(taunt.fingerId)
      if (!f) continue
      let fontSize = 18
      ctx.font = tauntFont(fontSize)
      let textW = ctx.measureText(taunt.message).width
      const maxW = this.w - margin * 2 - 32
      if (textW > maxW) {
        fontSize = Math.max(13, Math.floor((fontSize * maxW) / textW))
        ctx.font = tauntFont(fontSize)
        textW = ctx.measureText(taunt.message).width
      }
      const w = textW + 32
      const h = fontSize + 26
      let best: TauntLayout | null = null
      let bestScore = -Infinity
      const winner = game.fingers.get(result.winnerId)!
      const wr = r * 1.55
      const labelAbove = winner.y - wr - 150 > 0
      const label = {
        x0: clamp(winner.x, 90, this.w - 90) - 115,
        x1: clamp(winner.x, 90, this.w - 90) + 115,
        y0: labelAbove ? winner.y - wr - 130 : winner.y + wr + 20,
        y1: labelAbove ? winner.y - wr - 20 : winner.y + wr + 130,
      }
      for (const reach of [r + 70, r + 120, r + 180]) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2
          const bx = clamp(f.x + Math.cos(a) * (reach + w / 4), margin + w / 2, this.w - margin - w / 2)
          // Tilted bubbles stick out further vertically, so leave room for that.
          const vMargin = margin + w * 0.04 + 8
          const by = clamp(f.y + Math.sin(a) * reach, vMargin + h / 2, this.h - vMargin - h / 2)
          const rect = { x0: bx - w / 2, x1: bx + w / 2, y0: by - h / 2, y1: by + h / 2 }
          let score = -reach * 0.3 + (f.y - by) * 0.1
          for (const o of fingers) {
            const need = o.id === result.winnerId ? wr + 60 : r + 18
            const d = rectDistance(rect, o.x, o.y)
            if (d < need) score -= (need - d) * 20
          }
          score -= overlapArea(rect, label) * 3
          if (segmentDistance(winner.x, winner.y, bx, by, f.x, f.y) < wr + 30) score -= 800
          for (const p of placed) {
            const other = { x0: p.bx - p.w / 2 - 10, x1: p.bx + p.w / 2 + 10, y0: p.by - p.h / 2 - 10, y1: p.by + p.h / 2 + 10 }
            if (overlapArea(rect, other) > 0) score -= 5000
          }
          if (score > bestScore) {
            bestScore = score
            best = { fingerId: f.id, message: taunt.message, bx, by, w, h, tilt: 0, fontSize }
          }
        }
      }
      if (best) {
        best.tilt = (placed.length % 2 === 0 ? -1 : 1) * 0.06
        placed.push(best)
      }
    }
    return placed
  }

  /** Start screen: ghost rings breathe in finger colors around the title. */
  private drawZeroState(now: number): void {
    const { ctx } = this
    const t = this.reducedMotion ? 0 : now / 1000
    const r = this.radius
    GHOST_RINGS.forEach((g, i) => {
      const phase = t * 0.9 + i * 1.3
      const breathe = 0.5 + 0.5 * Math.sin(phase)
      const x = g.x * this.w + Math.sin(t * 0.4 + i) * 8
      const y = g.y * this.h + Math.cos(t * 0.35 + i * 2) * 8
      const color = fingerColor(i)
      this.disc(x, y, r * (0.9 + 0.1 * breathe), color, 0.08 + 0.1 * breathe)
      this.ring(x, y, r * (0.9 + 0.1 * breathe), color, 0.35 + 0.35 * breathe)
    })

    const cx = this.w / 2
    const cy = this.h / 2
    const bob = this.reducedMotion ? 0 : Math.sin(now / 600) * 4
    const glow = fingerColor(Math.floor(t / 1.5) % GHOST_RINGS.length)
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const title = 'You have been chosen'
    let size = 44
    ctx.font = titleFont(size)
    const fit = (this.w - 48) / ctx.measureText(title).width
    if (fit < 1) {
      size = Math.floor(size * fit)
      ctx.font = titleFont(size)
    }
    ctx.shadowColor = glow
    ctx.shadowBlur = 24
    ctx.fillStyle = '#ffffff'
    ctx.fillText(title, cx, cy + bob)
    ctx.restore()
  }

  private ring(x: number, y: number, r: number, color: string, alpha: number, width = 6): void {
    if (r <= 0 || alpha <= 0) return
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private disc(x: number, y: number, r: number, color: string, alpha: number): void {
    if (r <= 0) return
    const { ctx } = this
    ctx.fillStyle = withAlpha(color, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  private arc(x: number, y: number, r: number, progress: number, color: string): void {
    if (progress <= 0) return
    const { ctx } = this
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

interface Rect {
  x0: number
  x1: number
  y0: number
  y1: number
}

function rectDistance(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1)
  const dy = Math.max(r.y0 - y, 0, y - r.y1)
  return Math.hypot(dx, dy)
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  return w > 0 && h > 0 ? w * h : 0
}

/** Distance from point (px, py) to the segment (ax, ay)-(bx, by). */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1)
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy))
}

function quad(a: number, c: number, b: number, t: number): number {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b
}

function titleFont(size: number): string {
  return `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
}

function tauntFont(size: number): string {
  return `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
