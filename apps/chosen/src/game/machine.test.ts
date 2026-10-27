import { describe, expect, it } from 'vitest'
import { COUNTDOWN_MS, FADE_OUT_MS, Game, MAX_FINGERS, RESULT_HOLD_MS } from './machine'

const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('Game', () => {
  it('stays idle with one finger', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.tick(10_000)
    expect(g.phase).toBe('idle')
  })

  it('starts counting at two fingers and picks after 4 seconds', () => {
    const g = new Game(() => 0)
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 100)
    expect(g.phase).toBe('counting')
    expect(g.tick(100 + COUNTDOWN_MS - 1).some((e) => e.type === 'chosen')).toBe(false)
    const events = g.tick(100 + COUNTDOWN_MS)
    expect(events.some((e) => e.type === 'chosen')).toBe(true)
    expect(g.phase).toBe('chosen')
    expect(g.result?.winnerId).toBe(1)
  })

  it('restarts the countdown when a finger joins at 3.9s', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    g.tick(3900)
    expect(g.add(3, 0, 0, 3900)).toContainEqual({ type: 'restart' })
    g.tick(4100)
    expect(g.phase).toBe('counting')
    g.tick(3900 + COUNTDOWN_MS)
    expect(g.phase).toBe('chosen')
  })

  it('restarts when a finger lifts but two remain', () => {
    const g = new Game()
    for (const id of [1, 2, 3]) g.add(id, 0, 0, 0)
    expect(g.remove(3, 2000)).toContainEqual({ type: 'restart' })
    expect(g.countdownStart).toBe(2000)
  })

  it('drops back to idle below two fingers', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    g.remove(2, 1000)
    expect(g.phase).toBe('idle')
    g.tick(10_000)
    expect(g.phase).toBe('idle')
  })

  it('moving a finger does not restart', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    g.move(1, 50, 50)
    expect(g.countdownStart).toBe(0)
    expect(g.fingers.get(1)).toMatchObject({ x: 50, y: 50 })
  })

  it('fires seven ticks before the pick', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    const ticks = g.tick(COUNTDOWN_MS).filter((e) => e.type === 'tick')
    expect(ticks).toHaveLength(7)
  })

  it('taunts one loser with 2-3 players and two with 4+', () => {
    const three = new Game(seq(0.5, 0.1, 0.9, 0.3))
    for (const id of [1, 2, 3]) three.add(id, 0, 0, 0)
    three.tick(COUNTDOWN_MS)
    expect(three.result?.taunts).toHaveLength(1)

    const four = new Game(seq(0.5, 0.1, 0.9, 0.3))
    for (const id of [1, 2, 3, 4]) four.add(id, 0, 0, 0)
    four.tick(COUNTDOWN_MS)
    const { taunts, winnerId } = four.result!
    expect(taunts).toHaveLength(2)
    expect(taunts.map((t) => t.fingerId)).not.toContain(winnerId)
    expect(new Set(taunts.map((t) => t.message)).size).toBe(2)
  })

  it('ignores new fingers while the result shows and resets after everyone lifts', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    g.tick(COUNTDOWN_MS)
    expect(g.add(3, 0, 0, COUNTDOWN_MS + 10)).toEqual([])
    expect(g.fingers.size).toBe(2)

    const t = COUNTDOWN_MS + RESULT_HOLD_MS
    g.remove(1, t)
    g.remove(2, t)
    expect(g.phase).toBe('chosen') // finger 3 is still down
    g.remove(3, t)
    expect(g.phase).toBe('fading')
    expect(g.tick(t + FADE_OUT_MS)).toContainEqual({ type: 'reset' })
    expect(g.phase).toBe('idle')
    expect(g.fingers.size).toBe(0)
  })

  it('holds the result for a minimum time even if everyone lifts at once', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    g.tick(COUNTDOWN_MS)
    g.remove(1, COUNTDOWN_MS + 100)
    g.remove(2, COUNTDOWN_MS + 100)
    expect(g.phase).toBe('chosen')
    g.tick(COUNTDOWN_MS + RESULT_HOLD_MS)
    expect(g.phase).toBe('fading')
  })

  it('reuses the lowest free color', () => {
    const g = new Game()
    g.add(1, 0, 0, 0)
    g.add(2, 0, 0, 0)
    g.add(3, 0, 0, 0)
    g.remove(2, 0)
    g.add(4, 0, 0, 0)
    expect(g.fingers.get(4)?.color).toBe(1)
  })

  it('caps the number of players', () => {
    const g = new Game()
    for (let id = 0; id < MAX_FINGERS + 2; id++) g.add(id, 0, 0, 0)
    expect(g.fingers.size).toBe(MAX_FINGERS)
  })
})
