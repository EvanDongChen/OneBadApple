import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import type { Group, Mesh } from 'three'
import { fruitPositions, useSim } from '../sim/store'
import { LOOKS } from './fruitLooks'

const SEGMENTS = 18 // pieces the curved shaft is cut into
const HEAD_LENGTH = 0.55
const CLEAR = 0.85 // how far from a fruit's middle an arrow starts and stops
const INK = '#2a1a12'
const OUTLINE = 0.05 // how far the ink edge sticks out around the colour
// Between these distances apart, an arrow rises from the ground to arc over the fruits' heads.
const ARC_FAR = 3.6
const ARC_NEAR = 2.5
const HEAD_CLEAR = 0.72 // how far above a fruit's middle an overhead arrow starts and ends

interface Edge {
  from: string
  to: string
  belief: number
  color: string
  /** Under about 25% it is closer to trust than suspicion. */
  calm: boolean
  note: string
  /** Show the reason as well as the number. */
  detailed: boolean
}

/**
 * The suspicion map, drawn on the ground of the 3D world. Each arrow curves from a fruit to
 * one it suspects, in that fruit's own colour with an ink edge, and follows them both as
 * they walk. It starts thin and swells toward the head, and is thicker the surer the fruit
 * is. A small tag on each arrow gives the percentage and, for strong ones, the reason.
 * It shows the same arrows as the map panel, including when a single fruit is picked there.
 */
export default function SuspicionArrows() {
  const on = useSim((s) => s.arrows && s.screen === 'game' && !s.party)
  const fruits = useSim((s) => s.fruits)
  const picked = useSim((s) => s.arrowPick)
  if (!on) return null

  const living = fruits.filter((f) => f.alive)
  const pick = picked && living.some((f) => f.id === picked) ? picked : null
  const edges: Edge[] = []
  for (const a of living) {
    // Packmates know each other; that is not a suspicion and would give the wolves away.
    const others = living.filter((b) => b.id !== a.id && b.id in a.beliefs && !(a.role === 'werewolf' && b.role === 'werewolf'))
    const most = others.reduce<string | null>((best, b) => (best === null || a.beliefs[b.id] > a.beliefs[best] ? b.id : best), null)
    for (const b of others) {
      const belief = Math.round(a.beliefs[b.id])
      // Everyone's main suspect and anything they are fairly sure of; or, with a fruit picked, all of its own.
      const wanted = pick ? a.id === pick || b.id === pick : (b.id === most || belief >= 45) && belief >= 25
      if (!wanted) continue
      edges.push({ from: a.id, to: b.id, belief, color: LOOKS[a.kind].color, calm: belief < 25, note: a.feelings[b.id]?.note ?? '', detailed: !!pick || belief >= 50 })
    }
  }

  return (
    <>
      {edges.slice(0, 40).map((edge, i) => (
        <Arrow key={`${edge.from}>${edge.to}`} edge={edge} index={i} />
      ))}
    </>
  )
}

/** A flat arrow: a strip of quads for the shaft, then one triangle for the head. */
function arrowGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(((SEGMENTS + 1) * 2 + 3) * 3), 3))
  const index: number[] = []
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const head = (SEGMENTS + 1) * 2
  index.push(head, head + 1, head + 2)
  geometry.setIndex(index)
  return geometry
}

function Arrow({ edge, index }: { edge: Edge; index: number }) {
  const fill = useMemo(arrowGeometry, [])
  const ink = useMemo(arrowGeometry, [])
  const meshes = useRef<Group>(null)
  const tag = useRef<Group>(null)
  useEffect(
    () => () => {
      fill.dispose()
      ink.dispose()
    },
    [fill, ink],
  )

  const strength = Math.max(0, Math.min(1, (edge.belief - 15) / 70))
  const width = edge.calm ? 0.05 : 0.07 + strength * 0.2

  useFrame(() => {
    const a = fruitPositions.get(edge.from)
    const b = fruitPositions.get(edge.to)
    if (!a || !b || !meshes.current) return
    const dx = b.x - a.x
    const dz = b.z - a.z
    const span = Math.hypot(dx, dz) || 1
    const ux = dx / span
    const uz = dz / span
    // Far apart, the arrow lies on the ground between them. Close together there is no room
    // there, so it lifts up and arcs over their heads instead, blending from one to the other.
    const t0 = Math.max(0, Math.min(1, (ARC_FAR - span) / (ARC_FAR - ARC_NEAR)))
    const over = t0 * t0 * (3 - 2 * t0)
    const mix = (ground: number, air: number) => ground + (air - ground) * over
    const ground = 0.03 + index * 0.0016
    const clear = mix(CLEAR, 0.1)
    const headLength = mix(HEAD_LENGTH, 0.36)
    // The curve bows out to its own right, so two fruits that suspect each other get two separate arrows.
    const bow = mix(Math.min(1.1, span * 0.16), 0.3)
    const sx = a.x + ux * clear
    const sz = a.z + uz * clear
    const sy = mix(ground, a.y + HEAD_CLEAR)
    const ex = b.x - ux * clear
    const ez = b.z - uz * clear
    const ey = mix(ground, b.y + HEAD_CLEAR)
    const cx = (sx + ex) / 2 + uz * bow
    const cz = (sz + ez) / 2 - ux * bow
    const cy = mix(ground, (sy + ey) / 2 + 1.0 + span * 0.3)
    const at = (t: number): [number, number, number] => {
      const p = (1 - t) * (1 - t)
      const q = 2 * (1 - t) * t
      const r = t * t
      return [p * sx + q * cx + r * ex, p * sy + q * cy + r * ey, p * sz + q * cz + r * ez]
    }

    // The tag rides on the curve, a little over half way along.
    if (tag.current) {
      const [tx, ty, tz] = at(0.56)
      tag.current.position.set(tx, mix(0.45, ty + 0.18), tz)
    }
    // Roughly how long the curve is, to leave room for the head.
    const [mx, my, mz] = at(0.5)
    const length = Math.hypot(mx - sx, my - sy, mz - sz) + Math.hypot(ex - mx, ey - my, ez - mz)
    const room = length > headLength + 0.3
    meshes.current.visible = room
    if (!room) return

    const neck = 1 - headLength / length // where the shaft ends and the head begins
    const write = (geometry: BufferGeometry, extra: number, lift: number) => {
      const position = geometry.getAttribute('position') as BufferAttribute
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = (i / SEGMENTS) * neck
        const [px, py, pz] = at(t)
        const [qx, , qz] = at(Math.min(1, t + 0.01))
        const tl = Math.hypot(qx - px, qz - pz)
        // Sideways from the direction of travel, kept level so the ribbon faces up at the camera.
        const nx = tl > 1e-5 ? (qz - pz) / tl : uz
        const nz = tl > 1e-5 ? -(qx - px) / tl : -ux
        // Thin at the tail, swelling toward the head.
        // Overhead arcs are drawn a little bolder, since they are seen from further off.
        const half = (width * mix(1, 1.35) * (0.3 + 0.7 * (i / SEGMENTS))) / 2 + extra
        position.setXYZ(i * 2, px + nx * half, py + lift, pz + nz * half)
        position.setXYZ(i * 2 + 1, px - nx * half, py + lift, pz - nz * half)
      }
      const [bx, by, bz] = at(neck)
      const hl = Math.hypot(ex - bx, ey - by, ez - bz) || 1
      const hx = (ex - bx) / hl
      const hy = (ey - by) / hl
      const hz = (ez - bz) / hl
      const flat = Math.hypot(hx, hz) || 1
      const half = width * 1.25 + 0.1 + extra * 1.6
      const head = (SEGMENTS + 1) * 2
      position.setXYZ(head, bx - hx * extra + (hz / flat) * half, by - hy * extra + lift, bz - hz * extra - (hx / flat) * half)
      position.setXYZ(head + 1, ex + hx * extra * 2, ey + hy * extra * 2 + lift, ez + hz * extra * 2)
      position.setXYZ(head + 2, bx - hx * extra - (hz / flat) * half, by - hy * extra + lift, bz - hz * extra + (hx / flat) * half)
      position.needsUpdate = true
    }
    write(ink, OUTLINE, 0)
    write(fill, 0, 0.0008)
  })

  return (
    <>
      <group ref={meshes}>
        {(
          [
            [ink, INK],
            [fill, edge.color],
          ] as const
        ).map(([geometry, color], i) => (
          <mesh key={i} geometry={geometry} frustumCulled={false} ref={(m: Mesh | null) => void (m && (m.renderOrder = i))}>
            <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={edge.calm ? 0.5 : 0.55 + strength * 0.45} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={tag}>
        <Html center zIndexRange={[4, 0]}>
          <div className={`arrow-tag${edge.calm ? ' calm' : ''}`} style={{ '--fruit': edge.color } as React.CSSProperties}>
            <b>{edge.belief}%</b>
            {edge.detailed && edge.note && <span>{edge.note}</span>}
          </div>
        </Html>
      </group>
    </>
  )
}
