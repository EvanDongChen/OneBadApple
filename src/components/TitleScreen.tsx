import { useEffect } from 'react'
import { unlockAudio } from '../sim/sfx'
import { useSim } from '../sim/store'

/** The opening: the logo over a village of fruits wandering about, and a button to go in. */
export default function TitleScreen() {
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
    useSim.getState().enterSetup()
  }

  return (
    <div className="title">
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
