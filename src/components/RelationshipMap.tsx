import { useState } from 'react'
import { useSim } from '../sim/store'
import { LOOKS, ROLE_TAG } from './fruitLooks'
import RichText from './RichText'

const SIZE = 340
const CENTRE = SIZE / 2
const RING = 118 // radius of the circle the fruits sit on
const NODE = 15 // radius of a fruit's dot

interface Edge {
  from: string
  to: string
  /** How sure `from` is, 0 to 100, that `to` is a wolf. */
  belief: number
  /** `to` is the fruit `from` suspects most. */
  top: boolean
}

/**
 * The whole village's thinking at a glance: every fruit on a circle, with an arrow from each
 * fruit to the ones it suspects. Thicker, redder arrows mean it is more sure. The picture
 * redraws itself as beliefs move. Tap a fruit to see only its own arrows, with the numbers.
 */
export default function RelationshipMap({ onClose }: { onClose(): void }) {
  const fruits = useSim((s) => s.fruits)
  const reveal = useSim((s) => s.revealRoles)
  const [picked, setPicked] = useState<string | null>(null)

  const living = fruits.filter((f) => f.alive)
  const pick = living.some((f) => f.id === picked) ? picked : null
  const spot = new Map(
    fruits.map((f, i) => {
      const angle = (i / fruits.length) * Math.PI * 2 - Math.PI / 2
      return [f.id, [CENTRE + Math.cos(angle) * RING, CENTRE + Math.sin(angle) * RING] as const]
    }),
  )
  const nameOf = (id: string) => fruits.find((f) => f.id === id)?.name ?? '?'

  const edges: Edge[] = []
  for (const a of living) {
    // Packmates know each other, which is knowledge rather than a suspicion, and would give the wolves away.
    const others = living.filter((b) => b.id !== a.id && b.id in a.beliefs && !(a.role === 'werewolf' && b.role === 'werewolf'))
    const most = others.reduce<string | null>((best, b) => (best === null || a.beliefs[b.id] > a.beliefs[best] ? b.id : best), null)
    for (const b of others) edges.push({ from: a.id, to: b.id, belief: Math.round(a.beliefs[b.id]), top: b.id === most })
  }
  // With nobody picked, show each fruit's main suspect and anything it is fairly sure of.
  const shown = edges.filter((e) => (pick ? e.from === pick || e.to === pick : e.top || e.belief >= 45))

  /** How suspected each fruit is by the village as a whole: the average of everyone's belief about it. */
  const heat = new Map(
    living.map((f) => {
      const about = edges.filter((e) => e.to === f.id)
      return [f.id, about.length ? about.reduce((sum, e) => sum + e.belief, 0) / about.length : 0]
    }),
  )
  const hottest = living.reduce<string | null>((best, f) => (best === null || heat.get(f.id)! > heat.get(best)! ? f.id : best), null)

  /** A gently bent arrow between two dots, stopping short of each, so A to B and B to A do not overlap. */
  const curve = (e: Edge) => {
    const [x1, y1] = spot.get(e.from)!
    const [x2, y2] = spot.get(e.to)!
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const sx = x1 + ux * (NODE + 2)
    const sy = y1 + uy * (NODE + 2)
    const ex = x2 - ux * (NODE + 7)
    const ey = y2 - uy * (NODE + 7)
    const bend = 16
    const cx = (sx + ex) / 2 - uy * bend
    const cy = (sy + ey) / 2 + ux * bend
    // Where the number goes: two thirds of the way along the curve.
    const t = 0.66
    const lx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex
    const ly = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey
    return { d: `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`, lx, ly }
  }

  const picked0 = living.find((f) => f.id === pick)
  const list = (items: Edge[], who: (e: Edge) => string) =>
    items
      .sort((a, b) => b.belief - a.belief)
      .slice(0, 4)
      .map((e) => `${nameOf(who(e))} ${e.belief}%`)
      .join(', ')

  return (
    <aside className="panel map">
      <div className="row spread">
        <h2>Who suspects whom</h2>
        <button onClick={onClose}>Close</button>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="A diagram of which fruits suspect which">
        <defs>
          <marker id="map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#c2261a" />
          </marker>
          <marker id="map-arrow-calm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#1f8a5b" />
          </marker>
        </defs>

        {shown.map((e) => {
          const { d, lx, ly } = curve(e)
          // Below about 25% it is closer to trust than suspicion: drawn green and dashed, only for a picked fruit.
          const calm = e.belief < 25
          if (calm && !pick) return null
          const strength = Math.max(0, Math.min(1, (e.belief - 15) / 70))
          return (
            <g key={`${e.from}-${e.to}`} className={`edge${calm ? ' calm' : ''}`}>
              <path
                d={d}
                style={{ strokeWidth: calm ? 1.5 : 1.2 + strength * 4.5, opacity: calm ? 0.7 : pick ? 0.9 : 0.3 + strength * 0.65 }}
                markerEnd={`url(#${calm ? 'map-arrow-calm' : 'map-arrow'})`}
              />
              {pick && (
                <text x={lx} y={ly} className="pct">
                  {e.belief}%
                </text>
              )}
            </g>
          )
        })}

        {fruits.map((f) => {
          const [x, y] = spot.get(f.id)!
          const warm = heat.get(f.id) ?? 0
          const below = y >= CENTRE
          return (
            <g
              key={f.id}
              className={`node${f.alive ? '' : ' dead'}${pick === f.id ? ' on' : ''}${pick && pick !== f.id ? ' dim' : ''}`}
              onClick={() => f.alive && setPicked(pick === f.id ? null : f.id)}
            >
              {/* A red halo that grows with how suspected the fruit is by everyone. */}
              {f.alive && <circle cx={x} cy={y} r={NODE + 2 + warm * 0.13} className="heat" style={{ opacity: Math.min(0.55, warm / 110) }} />}
              <circle cx={x} cy={y} r={NODE} fill={f.alive ? LOOKS[f.kind].color : '#b9ad9b'} className="dot" />
              {!f.alive && <path d={`M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}`} className="cross" />}
              <text x={x} y={below ? y + NODE + 15 : y - NODE - 7} className="name">
                {f.name}
              </text>
              {(reveal || !f.alive) && (
                <text x={x} y={below ? y + NODE + 27 : y - NODE - 19} className={`tag ${f.role}`}>
                  {ROLE_TAG[f.role]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="hint">
        {picked0 ? (
          <>
            <RichText text={`${picked0.name} suspects: ${list(edges.filter((e) => e.from === picked0.id), (e) => e.to) || 'nobody'}.`} />
            <br />
            <RichText text={`Suspected by: ${list(edges.filter((e) => e.to === picked0.id), (e) => e.from) || 'nobody'}.`} />
          </>
        ) : hottest ? (
          <>
            <RichText text={`The village's main suspect is ${nameOf(hottest)}, at ${Math.round(heat.get(hottest)!)}% on average.`} /> Thicker arrows are surer. Tap a fruit to see only its own.
          </>
        ) : (
          'Nobody left to suspect.'
        )}
      </p>
    </aside>
  )
}
