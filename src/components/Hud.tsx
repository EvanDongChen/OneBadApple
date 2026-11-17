import { useEffect, useRef, useState } from 'react'
import { startGame, stopGame } from '../sim/engine'
import { useSim } from '../sim/store'
import type { Phase } from '../sim/types'
import { LOOKS, ROLE_TAG } from './fruitLooks'
import Recap from './Recap'
import RichText from './RichText'

const PHASE_LABEL: Record<Phase, string> = {
  setup: 'Setup',
  night: 'Night',
  dawn: 'Dawn',
  talk: 'Talking it over',
  vote: 'The vote',
  over: 'Game over',
}

const SPEEDS = [1, 2, 4]

/** In-game overlay: the hanging sign with controls, the villager list, the gossip log and the end card. */
export default function Hud() {
  const phase = useSim((s) => s.phase)
  const day = useSim((s) => s.day)
  const fruits = useSim((s) => s.fruits)
  const votes = useSim((s) => s.votes)
  const log = useSim((s) => s.log)
  const paused = useSim((s) => s.paused)
  const speed = useSim((s) => s.speed)
  const revealRoles = useSim((s) => s.revealRoles)
  const showThoughts = useSim((s) => s.showThoughts)
  const winner = useSim((s) => s.winner)
  const calls = useSim((s) => s.calls)
  const settings = useSim((s) => s.settings)
  const logEnd = useRef<HTMLDivElement>(null)
  const [mindId, setMindId] = useState<string | null>(null)
  const [recapOpen, setRecapOpen] = useState(false)
  const mind = fruits.find((f) => f.id === mindId)
  const dark = phase === 'night'

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [log.length])

  const voteCount = (id: string) => Object.values(votes).filter((v) => v === id).length

  return (
    <>
      <header className="sign">
        <div className="plank">
          <span className={`sky-icon${dark ? ' moon' : ''}`} />
          <span className="phase">{phase === 'over' ? 'Game over' : `Day ${day}: ${PHASE_LABEL[phase]}`}</span>
        </div>
        <div className="controls">
          <button onClick={() => useSim.setState({ paused: !paused })}>{paused ? 'Resume' : 'Pause'}</button>
          <button onClick={() => useSim.setState({ speed: SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] })}>Speed {speed}x</button>
          <button className={revealRoles ? 'on' : ''} onClick={() => useSim.setState({ revealRoles: !revealRoles })}>
            {revealRoles ? 'Hide roles' : 'Peek at roles'}
          </button>
          <button className={showThoughts ? 'on' : ''} onClick={() => useSim.setState({ showThoughts: !showThoughts })}>
            {showThoughts ? 'Hide thoughts' : 'Show thoughts'}
          </button>
          <button onClick={() => useSim.getState().setSettings({ muted: !settings.muted })}>{settings.muted ? 'Sound on' : 'Sound off'}</button>
          <button className="danger" onClick={stopGame}>
            Quit
          </button>
        </div>
      </header>

      <aside className="panel roster">
        <h2>Villagers</h2>
        {fruits.map((f) => (
          <button
            key={f.id}
            className={`roster-row${f.alive ? '' : ' dead'}${f.id === mindId ? ' on' : ''}`}
            onClick={() => setMindId(f.id === mindId ? null : f.id)}
          >
            <span className="dot" style={{ background: LOOKS[f.kind].color }} />
            <span className="who">{f.name}</span>
            {(revealRoles || !f.alive) && <span className={`role ${f.role}`}>{ROLE_TAG[f.role]}</span>}
            {voteCount(f.id) > 0 && <span className="votes">{'✗'.repeat(voteCount(f.id))}</span>}
          </button>
        ))}
        <p className="hint">Tap a fruit to read its mind. Spoilers!</p>
        {mind && (
          <div className="mind">
            <div className="mind-head">
              <span className="dot" style={{ background: LOOKS[mind.kind].color }} />
              <b>{mind.name}</b>
              <span className={`role ${mind.role}`}>{ROLE_TAG[mind.role]}</span>
            </div>
            <p className="thought">{mind.thought ? <RichText text={mind.thought} /> : 'Nothing on its mind yet.'}</p>
            {mind.traits.backstory && <p className="hint">"{mind.traits.backstory}"</p>}
            {fruits
              .filter((o) => o.id !== mind.id && mind.feelings[o.id])
              .map((o) => {
                const feel = mind.feelings[o.id]
                return (
                  <div key={o.id} className={`feeling${o.alive ? '' : ' dead'}`}>
                    <span className="who">
                      <RichText text={o.name} />
                    </span>
                    <span className="meter" title={`Trust ${feel.trust}`}>
                      <i className={feel.trust < 0 ? 'bad' : 'good'} style={{ width: `${Math.abs(feel.trust) * 10}%`, [feel.trust < 0 ? 'right' : 'left']: '50%' }} />
                    </span>
                    <span className="note">{feel.note}</span>
                  </div>
                )
              })}
          </div>
        )}
        {settings.brain === 'gemini' && (
          <p className="hint">
            Gemini calls: {calls} of {settings.maxCalls}
          </p>
        )}
      </aside>

      <section className="panel log">
        <h2>Village gossip</h2>
        <div className="log-lines">
          {log.map((entry, i) => (
            <p key={i} className={entry.kind}>
              {entry.name && (
                <>
                  <RichText text={entry.name} />
                  {entry.kind === 'ghost' && <span className="verb">'s ghost</span>}
                  {entry.to && (
                    <>
                      <span className="verb"> to </span>
                      <RichText text={entry.to} />
                    </>
                  )}
                  <span className="verb">: </span>
                </>
              )}
              <RichText text={entry.text} />
            </p>
          ))}
          <div ref={logEnd} />
        </div>
      </section>

      {winner && recapOpen && <Recap onClose={() => setRecapOpen(false)} />}

      {winner && !recapOpen && (
        <div className="panel banner">
          <h1>{winner === 'village' ? 'The village wins!' : winner === 'jester' ? 'The jester wins!' : 'The wolves win!'}</h1>
          <p>
            {winner === 'village'
              ? 'Every werewolf was caught.'
              : winner === 'jester'
                ? 'It got itself voted out, which was the plan all along.'
                : 'The wolves now outnumber everyone else.'}{' '}
            It took {day} day{day > 1 ? 's' : ''}.
          </p>
          <div className="row">
            <button className="primary" onClick={startGame}>
              Play again
            </button>
            <button onClick={() => setRecapOpen(true)}>Read the recap</button>
            <button onClick={stopGame}>Change the villagers</button>
          </div>
        </div>
      )}
    </>
  )
}
