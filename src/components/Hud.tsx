import { useEffect, useRef } from 'react'
import { startGame, stopGame } from '../sim/engine'
import { useSim } from '../sim/store'
import type { Phase } from '../sim/types'
import { LOOKS, ROLE_TAG } from './fruitLooks'

const PHASE_LABEL: Record<Phase, string> = {
  setup: 'Setup',
  night: 'Night',
  dawn: 'Dawn',
  mingle: 'Morning chats',
  discussion: 'Village meeting',
  vote: 'Vote',
  over: 'Game over',
}

const SPEEDS = [1, 2, 4]

/** In-game overlay: phase bar and controls, the roster, the event log and the end banner. */
export default function Hud() {
  const phase = useSim((s) => s.phase)
  const day = useSim((s) => s.day)
  const fruits = useSim((s) => s.fruits)
  const votes = useSim((s) => s.votes)
  const log = useSim((s) => s.log)
  const paused = useSim((s) => s.paused)
  const speed = useSim((s) => s.speed)
  const revealRoles = useSim((s) => s.revealRoles)
  const winner = useSim((s) => s.winner)
  const calls = useSim((s) => s.calls)
  const settings = useSim((s) => s.settings)
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [log.length])

  const voteCount = (id: string) => Object.values(votes).filter((v) => v === id).length

  return (
    <>
      <header className="panel topbar">
        <span className={`phase ${phase}`}>
          {phase === 'over' ? 'Game over' : `Day ${day} · ${PHASE_LABEL[phase]}`}
        </span>
        <button onClick={() => useSim.setState({ paused: !paused })}>{paused ? 'Resume' : 'Pause'}</button>
        <button onClick={() => useSim.setState({ speed: SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] })}>
          Speed {speed}x
        </button>
        <button className={revealRoles ? 'on' : ''} onClick={() => useSim.setState({ revealRoles: !revealRoles })}>
          {revealRoles ? 'Hide roles' : 'Reveal roles'}
        </button>
        <button onClick={() => useSim.getState().setSettings({ muted: !settings.muted })}>
          {settings.muted ? 'Unmute' : 'Mute'}
        </button>
        <button className="danger" onClick={stopGame}>
          End game
        </button>
      </header>

      <aside className="panel roster">
        {fruits.map((f) => (
          <div key={f.id} className={`roster-row${f.alive ? '' : ' dead'}`}>
            <span className="dot" style={{ background: LOOKS[f.kind].color }} />
            <span className="who">{f.name}</span>
            {(revealRoles || !f.alive) && <span className={`role ${f.role}`}>{ROLE_TAG[f.role]}</span>}
            {voteCount(f.id) > 0 && <span className="votes">{voteCount(f.id)} vote{voteCount(f.id) > 1 ? 's' : ''}</span>}
          </div>
        ))}
        {settings.brain === 'gemini' && (
          <p className="muted">
            Gemini calls: {calls} / {settings.maxCalls}
          </p>
        )}
      </aside>

      <section className="panel log">
        {log.map((entry, i) => (
          <p key={i} className={entry.kind}>
            {entry.name && <b>{entry.name}{entry.kind === 'whisper' ? ' (privately)' : ''}: </b>}
            {entry.text}
          </p>
        ))}
        <div ref={logEnd} />
      </section>

      {winner && (
        <div className="panel banner">
          <h2>{winner === 'village' ? 'The village wins' : 'The werewolves win'}</h2>
          <p className="muted">
            {winner === 'village' ? 'Every werewolf was caught.' : 'The wolves now outnumber the rest.'} Lasted {day} day{day > 1 ? 's' : ''}.
          </p>
          <div className="row">
            <button className="primary" onClick={startGame}>
              Play again
            </button>
            <button onClick={stopGame}>Change setup</button>
          </div>
        </div>
      )}
    </>
  )
}
