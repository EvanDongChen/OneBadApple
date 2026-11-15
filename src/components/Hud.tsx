import { useSim } from '../sim/store'

/** Overlay: mode badge, pause button and the recent chat log. */
export default function Hud() {
  const log = useSim((s) => s.log)
  const paused = useSim((s) => s.paused)
  const togglePaused = useSim((s) => s.togglePaused)

  return (
    <div className="hud">
      <div className="hud-top">
        <span className="badge">Test talk mode</span>
        <button onClick={togglePaused}>{paused ? 'Resume' : 'Pause'}</button>
      </div>
      <div className="log">
        {log.slice(-6).map((line, i) => (
          <p key={`${log.length}-${i}`}>
            <b>{line.name}:</b> {line.text}
          </p>
        ))}
        {log.length === 0 && <p className="muted">The fruits are gathering...</p>}
      </div>
    </div>
  )
}
