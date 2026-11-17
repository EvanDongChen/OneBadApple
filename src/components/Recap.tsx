import { useSim } from '../sim/store'
import type { FruitState, RecapEvent } from '../sim/types'
import { ROLE_TAG } from './fruitLooks'
import RichText from './RichText'

type Of<K extends RecapEvent['kind']> = Extract<RecapEvent, { kind: K }>

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/** The story of the finished game, day by day: kills, votes, and changes of heart. */
export default function Recap({ onClose }: { onClose(): void }) {
  const recap = useSim((s) => s.recap)
  const fruits = useSim((s) => s.fruits)
  const fruit = (id: string): FruitState | undefined => fruits.find((f) => f.id === id)
  const name = (id: string) => fruit(id)?.name ?? 'someone'
  const isWolf = (id: string) => fruit(id)?.role === 'werewolf'

  /** A fruit's name followed by its role stamp. */
  const Who = ({ id }: { id: string }) => {
    const f = fruit(id)
    return (
      <>
        <RichText text={name(id)} />
        {f && <span className={`role ${f.role}`}>{ROLE_TAG[f.role]}</span>}
      </>
    )
  }

  const days = [...new Set(recap.map((e) => e.day))].sort((a, b) => a - b)

  return (
    <div className="panel recap">
      <div className="row spread">
        <h2>How it all went</h2>
        <button onClick={onClose}>Close</button>
      </div>

      {days.map((day) => {
        const events = recap.filter((e) => e.day === day)
        const voteAt = events.findIndex((e) => e.kind === 'vote')
        const night = voteAt < 0 ? events : events.slice(0, voteAt)
        const vote = voteAt < 0 ? undefined : (events[voteAt] as Of<'vote'>)
        const after = voteAt < 0 ? [] : events.slice(voteAt + 1)
        const turns = night.filter((e): e is Of<'turn'> => e.kind === 'turn')
        const deeds = night.filter((e) => e.kind !== 'turn')

        return (
          <section key={day}>
            <h3>
              <span className="sky-icon moon" /> Night {day}
            </h3>
            {deeds.map((e, i) => (
              <p key={i} className={`deed ${e.kind}`}>
                <Deed event={e} Who={Who} />
              </p>
            ))}

            {turns.length > 0 && (
              <div className="turns">
                <h4>Changes of heart</h4>
                {turns.map((e, i) => {
                  const against = e.to < 0
                  // Turning on a wolf, or warming to an innocent, was the right call.
                  const right = against === isWolf(e.about)
                  return (
                    <p key={i} className="turn">
                      <span className={`arrow ${against ? 'bad' : 'good'}`}>{against ? '▼' : '▲'}</span>
                      <span>
                        <RichText text={`${name(e.who)} ${against ? 'turned against' : 'came to trust'} ${name(e.about)}`} />{' '}
                        <span className="muted">
                          ({signed(e.from)} to {signed(e.to)})
                        </span>
                        {/* A wolf knows the truth, so its "trust" is not a guess to mark. */}
                        {!isWolf(e.who) && <span className={`verdict ${right ? 'right' : 'wrong'}`}>{right ? 'right' : 'wrong'}</span>}
                        {e.note && <i className="note"> “{e.note}”</i>}
                      </span>
                    </p>
                  )
                })}
              </div>
            )}

            {vote && (
              <>
                <h3>
                  <span className="sky-icon" /> Day {day}
                </h3>
                <div className="ballots">
                  {[...new Set(vote.ballots.map((b) => b.target))]
                    .map((target) => ({ target, voters: vote.ballots.filter((b) => b.target === target).map((b) => b.voter) }))
                    .sort((a, b) => b.voters.length - a.voters.length)
                    .map(({ target, voters }) => (
                      <p key={target} className="ballot">
                        <span className="target">
                          <Who id={target} />
                        </span>
                        <span className="crosses">{'✗'.repeat(voters.length)}</span>
                        <span className="voters">
                          <span className="muted">from </span>
                          <RichText text={voters.map(name).join(', ')} />
                        </span>
                      </p>
                    ))}
                </div>
                <p className="deed vote">
                  {vote.out ? (
                    <>
                      <Who id={vote.out} /> was voted out.
                    </>
                  ) : (
                    <>
                      <RichText text={`A tie between ${vote.tied.map(name).join(' and ')}.`} /> Nobody was voted out.
                    </>
                  )}
                </p>
                {after.map((e, i) => (
                  <p key={i} className={`deed ${e.kind}`}>
                    <Deed event={e} Who={Who} />
                  </p>
                ))}
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Deed({ event, Who }: { event: RecapEvent; Who(props: { id: string }): React.ReactNode }) {
  switch (event.kind) {
    case 'kill':
      return (
        <>
          <Who id={event.wolf} /> sliced up <Who id={event.victim} />.
        </>
      )
    case 'saved':
      return (
        <>
          <Who id={event.wolf} /> went for <Who id={event.victim} />, but{' '}
          {event.doctor ? (
            <>
              <Who id={event.doctor} /> was standing guard.
            </>
          ) : (
            'the doctor was standing guard.'
          )}
        </>
      )
    case 'inspect':
      return (
        <>
          <Who id={event.seer} /> looked into <Who id={event.target} /> and saw {event.wolf ? 'a werewolf' : 'no werewolf'}.
        </>
      )
    case 'shot':
      return (
        <>
          <Who id={event.hunter} /> took <Who id={event.target} /> down with it.
        </>
      )
    default:
      return null
  }
}
