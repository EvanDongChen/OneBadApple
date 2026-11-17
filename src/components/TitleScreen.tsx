import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { unlockAudio } from '../sim/sfx'
import { useSim } from '../sim/store'

const SKY_HOLD_MS = 1300 // how long the logo hangs in the sky before the view comes down

/**
 * The opening. The page starts on the logo in a blue sky; once the 3D scene has loaded, the
 * view comes down out of the sky onto a village of fruits wandering about, the logo settles
 * at the top, and a button leads in.
 */
export default function TitleScreen() {
  const sceneReady = useSim((s) => s.sceneReady)
  const [held, setHeld] = useState(false)
  const down = sceneReady && held

  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), SKY_HOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  // Tell the camera when to start its descent, so it moves together with the sky.
  useEffect(() => {
    if (down) useSim.setState({ introAt: performance.now() })
  }, [down])

  // Every couple of seconds some of the fruits pick somewhere new to wander to.
  useEffect(() => {
    const wander = (everyone: boolean) =>
      useSim.setState((s) => ({
        targets: {
          ...s.targets,
          ...Object.fromEntries(
            s.fruits
              .filter(() => everyone || Math.random() < 0.5)
              .map((f) => {
                const angle = Math.random() * Math.PI * 2
                const radius = 3.5 + Math.random() * 5.5
                return [f.id, [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number]]
              }),
          ),
        },
      }))
    wander(true)
    const timer = setInterval(() => wander(false), 2400)
    return () => clearInterval(timer)
  }, [])

  function enter() {
    // The first click is also what lets the browser play sound later.
    unlockAudio()
    const go = () => useSim.getState().enterSetup()
    // Where the browser can do it, the card in the middle and the logo glide across and
    // become the side panel and its heading. Elsewhere the panel simply slides in.
    if (document.startViewTransition) document.startViewTransition(() => flushSync(go))
    else go()
  }

  return (
    <div className={`title${down ? ' down' : ''}`}>
      <div className="sky">
        <i className="cloud a" />
        <i className="cloud b" />
        <i className="cloud c" />
      </div>
      <div className="title-card">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <h1>
          One Bad
          <br />
          Apple
        </h1>
      </div>
      <div className="title-foot">
        <p>A village of fruit plays Werewolf. One of them is rotten.</p>
        <button className="primary" onClick={enter}>
          Meet the villagers
        </button>
        <p className="muted">Nobody plays. You just watch it go wrong.</p>
      </div>
    </div>
  )
}
