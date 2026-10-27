import { useEffect, useRef } from 'react'
import { sounds, unlockAudio } from './audio/sound'
import { Game, type GameEvent } from './game/machine'
import { Renderer } from './render/renderer'
import * as wakeLock from './wakeLock'
import './App.css'

const TAUNT_SOUND_DELAY_MS = 900

function playEvents(events: GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'join') sounds.join(e.color)
    else if (e.type === 'leave') sounds.leave(e.color)
    else if (e.type === 'restart') sounds.restart()
    else if (e.type === 'tick') sounds.tick(e.index)
    else if (e.type === 'chosen') sounds.chosen()
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const game = new Game()
    const renderer = new Renderer(canvas)
    let wompRound = 0
    let frame = 0

    const onResize = () => renderer.resize()
    onResize()
    window.addEventListener('resize', onResize)

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      unlockAudio()
      wakeLock.acquire()
      canvas.setPointerCapture?.(e.pointerId)
      playEvents(game.add(e.pointerId, e.clientX, e.clientY, performance.now()))
    }
    const onMove = (e: PointerEvent) => game.move(e.pointerId, e.clientX, e.clientY)
    const onUp = (e: PointerEvent) => playEvents(game.remove(e.pointerId, performance.now()))
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      const now = performance.now()
      for (const id of [...game.fingers.keys(), ...game.ignored]) game.remove(id, now)
    }
    const noMenu = (e: Event) => e.preventDefault()

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('lostpointercapture', onUp)
    window.addEventListener('contextmenu', noMenu)
    document.addEventListener('visibilitychange', onHide)

    const loop = () => {
      const now = performance.now()
      const events = game.tick(now)
      playEvents(events)
      if (events.some((e) => e.type === 'reset')) wakeLock.release()
      if (game.result && game.round !== wompRound && now - game.result.chosenAt >= TAUNT_SOUND_DELAY_MS) {
        wompRound = game.round
        sounds.womp()
      }
      renderer.draw(game, now)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('lostpointercapture', onUp)
      window.removeEventListener('contextmenu', noMenu)
      document.removeEventListener('visibilitychange', onHide)
      wakeLock.release()
    }
  }, [])

  return <canvas ref={canvasRef} className="stage" />
}
