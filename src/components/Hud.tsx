import { useEffect, useRef, useState } from 'react'
import { startGame, stopGame } from '../sim/engine'
import { describe, describeGoal, MOODS, suspectedBy, TEMPERS } from '../sim/mind'
import { useSim } from '../sim/store'
import type { Phase } from '../sim/types'
import { LOOKS, ROLE_TAG } from './fruitLooks'
import Recap from './Recap'
import RelationshipMap from './RelationshipMap'
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

const MOOD_LABEL: Record<(typeof MOODS)[number], string> = { fear: 'Afraid', anger: 'Angry', grief: 'Grieving', guilt: 'Guilty', smug: 'Smug' }

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
  const director = useSim((s) => s.director)
  const arrows = useSim((s) => s.arrows)
  const winner = useSim((s) => s.winner)
  const calls = useSim((s) => s.calls)
  const settings = useSim((s) => s.settings)
  const logEnd = useRef<HTMLDivElement>(null)
  const [mindId, setMindId] = useState<string | null>(null)
  const [recapOpen, setRecapOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const viewMenu = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState<{ key: number; title: string; sub: string; dark: boolean } | null>(null)
  const mind = fruits.find((f) => f.id === mindId)
  const dark = phase === 'night'

  const views = [
    { label: 'Director camera', hint: 'Follows the action by itself', on: director, toggle: () => useSim.setState({ director: !director }) },
    { label: 'Suspicion arrows', hint: 'On the ground, from each fruit to who it suspects', on: arrows, toggle: () => useSim.setState({ arrows: !arrows }) },
    { label: 'Suspicion map', hint: 'A diagram of who suspects whom', on: mapOpen, toggle: () => setMapOpen(!mapOpen) },
    { label: 'Thought bubbles', hint: "Every fruit's private thought over its head", on: showThoughts, toggle: () => useSim.setState({ showThoughts: !showThoughts }) },
    { label: 'Roles', hint: 'Show who is who. Spoilers!', on: revealRoles, toggle: () => useSim.setState({ revealRoles: !revealRoles }) },
  ]

  // The View menu closes when you click anywhere else or press Escape.
  useEffect(() => {
    if (!viewOpen) return
    const away = (e: PointerEvent) => {
      if (!viewMenu.current?.contains(e.target as Node)) setViewOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [viewOpen])

  // A title card sweeps across the screen each time the phase changes.
  useEffect(() => {
    const cards: Partial<Record<Phase, [string, string]>> = {
      night: [`Night ${day}`, 'Everyone heads home'],
      dawn: [`Day ${day}`, 'Dawn breaks'],
      talk: ['Talking it over', `Day ${day}`],
      vote: ['The vote', `Day ${day}`],
    }
    const next = cards[phase]
    if (!next) {
      setCard(null)
      return
    }
    setCard({ key: performance.now(), title: next[0], sub: next[1], dark: phase === 'night' })
    const timer = setTimeout(() => setCard(null), 2300)
    return () => clearTimeout(timer)
  }, [phase, day])

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [log.length])

  const nameOf = (id: string) => fruits.find((f) => f.id === id)?.name ?? 'someone'
  const mindIsWolf = mind?.role === 'werewolf'
  // Who it thinks suspects it: its own read of the others, not what they really believe.
  const threats = mind
    ? Object.entries(suspectedBy(mind))
        .filter(([id, n]) => n >= 30 && fruits.find((f) => f.id === id)?.alive)
        .map(([id]) => nameOf(id))
    : []
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
          {/* Everything that changes what you can see lives in one menu. */}
          <div className="menu" ref={viewMenu}>
            <button className={viewOpen ? 'on' : ''} aria-haspopup="menu" aria-expanded={viewOpen} onClick={() => setViewOpen(!viewOpen)}>
              View
              <span className="count">{views.filter((v) => v.on).length}</span>
            </button>
            {viewOpen && (
              <div className="menu-list" role="menu">
                {views.map((view) => (
                  <button key={view.label} role="menuitemcheckbox" aria-checked={view.on} className={`menu-item${view.on ? ' on' : ''}`} onClick={view.toggle}>
                    <i className="tick" />
                    <span>
                      <b>{view.label}</b>
                      <small>{view.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => useSim.getState().setSettings({ muted: !settings.muted })}>{settings.muted ? 'Sound on' : 'Sound off'}</button>
          <button className="danger" onClick={stopGame}>
            Quit
          </button>
        </div>
      </header>

      {card && (
        <div key={card.key} className={`phase-card${card.dark ? ' dark' : ''}`} aria-hidden="true">
          <span>{card.sub}</span>
          <h1>{card.title}</h1>
        </div>
      )}

      {mapOpen && <RelationshipMap onClose={() => setMapOpen(false)} />}

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
            <p className="hint">
              <b>{TEMPERS[mind.traits.temper].label}.</b> Wants: <RichText text={describeGoal(mind.goal, nameOf, mindIsWolf)} />
            </p>
            {MOODS.some((m) => mind.mood[m] > 0.15) && (
              <div className="moods">
                {MOODS.filter((m) => mind.mood[m] > 0.15).map((m) => (
                  <span key={m} className={`mood ${m}`} style={{ '--level': mind.mood[m] } as React.CSSProperties} title={`${Math.round(mind.mood[m] * 10)} out of 10`}>
                    {MOOD_LABEL[m]}
                  </span>
                ))}
              </div>
            )}
            <h3>{mindIsWolf ? 'How dangerous it thinks each fruit is' : 'How sure it is that each one is a wolf'}</h3>
            {fruits
              .filter((o) => o.id !== mind.id && o.alive && o.id in mind.beliefs && !(mindIsWolf && o.role === 'werewolf'))
              .sort((a, b) => mind.beliefs[b.id] - mind.beliefs[a.id])
              .map((o) => {
                const belief = Math.round(mind.beliefs[o.id])
                return (
                  <div key={o.id} className="feeling">
                    <span className="who">
                      <RichText text={o.name} />
                    </span>
                    <span className="meter one">
                      <i className={belief >= 50 ? 'bad' : 'good'} style={{ width: `${belief}%` }} />
                    </span>
                    <span className="pct">{belief}%</span>
                    <span className="note">{mind.feelings[o.id]?.note}</span>
                  </div>
                )
              })}
            {threats.length > 0 && (
              <p className="hint">
                Thinks these suspect it: <RichText text={threats.join(', ')} />
              </p>
            )}
            {mind.events.length > 0 && (
              <>
                <h3>Remembers</h3>
                {mind.events
                  .slice(-5)
                  .reverse()
                  .map((e, i) => (
                    <p key={i} className="memory">
                      <RichText text={describe(e, mind, nameOf)} />
                    </p>
                  ))}
              </>
            )}
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
