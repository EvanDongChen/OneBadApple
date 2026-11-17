import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, PlaneGeometry } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { fruitPositions, useSim } from '../sim/store'

const MAX = 36 // most arrows ever drawn at once
const HEAD_LENGTH = 0.5
const CLEAR = 0.85 // how far from a fruit's middle an arrow starts and stops

// A flat strip one unit long, lying on the ground and pointing along +Z.
const SHAFT = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5)
// A flat triangle, one unit wide and one long, pointing along +Z.
const HEAD = new BufferGeometry()
HEAD.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, 0, 0, 0, 0, 1, 0.5, 0, 0]), 3))

/**
 * The suspicion map, drawn on the ground of the 3D world: an arrow from each fruit to the
 * ones it suspects, following them as they walk. Thicker and more solid means surer. It
 * shows the same arrows as the map panel, including when a single fruit is picked there.
 */
export default function SuspicionArrows() {
  const on = useSim((s) => s.arrows && s.screen === 'game')
  const groups = useRef<(Group | null)[]>([])

  useFrame(() => {
    const sim = useSim.getState()
    let used = 0
    if (on && !sim.party) {
      const living = sim.fruits.filter((f) => f.alive)
      const pick = sim.arrowPick && living.some((f) => f.id === sim.arrowPick) ? sim.arrowPick : null
      for (const a of living) {
        // Packmates know each other; that is not a suspicion and would give the wolves away.
        const others = living.filter((b) => b.id !== a.id && b.id in a.beliefs && !(a.role === 'werewolf' && b.role === 'werewolf'))
        let most: string | null = null
        for (const b of others) if (most === null || a.beliefs[b.id] > a.beliefs[most]) most = b.id
        for (const b of others) {
          const belief = a.beliefs[b.id]
          // Everyone's main suspect and anything they are fairly sure of; or, with a fruit picked, all of its own.
          const wanted = pick ? a.id === pick || b.id === pick : (b.id === most || belief >= 45) && belief >= 25
          if (!wanted || used >= MAX) continue
          if (place(groups.current[used], used, a.id, b.id, belief)) used++
        }
      }
    }
    for (let i = used; i < MAX; i++) {
      const group = groups.current[i]
      if (group) group.visible = false
    }
  })

  if (!on) return null
  return (
    <>
      {Array.from({ length: MAX }, (_, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <mesh geometry={SHAFT}>
            <meshBasicMaterial transparent depthWrite={false} side={DoubleSide} />
          </mesh>
          <mesh geometry={HEAD}>
            <meshBasicMaterial transparent depthWrite={false} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Lay one arrow on the ground from fruit `from` to fruit `to`. Returns false if there is no room for it. */
function place(group: Group | null, index: number, from: string, to: string, belief: number): boolean {
  const a = fruitPositions.get(from)
  const b = fruitPositions.get(to)
  if (!group || !a || !b) return false
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.hypot(dx, dz) - CLEAR * 2 - HEAD_LENGTH
  if (length < 0.3) return false

  // Below about 25% it is closer to trust than suspicion: thin and green.
  const calm = belief < 25
  const strength = Math.max(0, Math.min(1, (belief - 15) / 70))
  const width = calm ? 0.07 : 0.08 + strength * 0.24
  const [shaft, head] = group.children as Mesh[]

  group.visible = true
  // Each arrow sits a hair higher than the last so overlapping ones do not flicker.
  group.position.set(a.x, 0.03 + index * 0.0015, a.z)
  group.rotation.y = Math.atan2(dx, dz)
  // Keep to one side of the line between the two fruits, so A to B and B to A lie side by side.
  shaft.position.set(0.17, 0, CLEAR)
  shaft.scale.set(width, 1, length)
  head.position.set(0.17, 0, CLEAR + length)
  head.scale.set(width * 2.4 + 0.14, 1, HEAD_LENGTH)
  for (const mesh of [shaft, head]) {
    const material = mesh.material as MeshBasicMaterial
    material.color.set(calm ? '#1f8a5b' : '#d8342c')
    material.opacity = calm ? 0.55 : 0.35 + strength * 0.55
  }
  return true
}
