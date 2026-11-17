import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { fruitPositions, useSim } from '../sim/store'

const WIDE = 24 // camera distance for the whole stage
const HOME = new Vector3(0, 1, 0)

/**
 * The director: while it is switched on, the camera goes to wherever the story is.
 * It follows the wolf at night, moves in on the kill and the shooting, and settles on
 * whoever is speaking. You can still swing the view around; the director only decides
 * what the camera looks at and how close it stands.
 */
export default function Director() {
  // OrbitControls registers itself here (makeDefault). Only its target and update() are needed.
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update(): void } | null
  const camera = useThree((s) => s.camera)
  const want = useMemo(() => new Vector3(), [])
  const offset = useMemo(() => new Vector3(), [])
  const shot = useRef({ subject: null as string | null, since: 0, wasGame: false, returning: false })

  useFrame((_, delta) => {
    if (!controls) return
    const sim = useSim.getState()
    const s = shot.current
    const inGame = sim.screen === 'game'
    // Leaving a game: ease back to the wide view once, then leave the camera to the viewer.
    if (s.wasGame && !inGame) s.returning = true
    s.wasGame = inGame
    if (!(inGame && sim.director) && !s.returning) return

    let distance = WIDE
    want.copy(HOME)
    const at = (id: string | null | undefined) => (id ? fruitPositions.get(id) : undefined)
    const now = performance.now()

    if (inGame && sim.director) {
      const speakers = Object.keys(sim.speech).filter((id) => sim.speech[id])
      if (sim.execution) {
        // The shooting: frame the gun and the condemned fruit together.
        const a = at(sim.execution.shooterId)
        const b = at(sim.execution.targetId)
        if (a && b) want.addVectors(a, b).multiplyScalar(0.5)
        distance = 9
      } else if (sim.attack) {
        // Night: stay with the wolf, then close in as it reaches its victim.
        const wolf = at(sim.attack.attackerId)
        const victim = at(sim.attack.victimId)
        if (wolf && victim && wolf.distanceTo(victim) < 5) {
          want.addVectors(wolf, victim).multiplyScalar(0.5)
          distance = 8
        } else if (wolf) {
          want.copy(wolf)
          distance = 12
        }
      } else if (sim.party) {
        distance = 17
      } else {
        // Stay on a speaker until it finishes, then cut to whoever is talking nearest to where
        // the camera already is, which keeps it with one conversation rather than hopping about.
        if (!(s.subject && speakers.includes(s.subject))) {
          if (speakers.length) {
            s.subject = speakers.reduce((a, b) => ((at(b)?.distanceTo(controls.target) ?? Infinity) < (at(a)?.distanceTo(controls.target) ?? Infinity) ? b : a))
            s.since = now
          } else if (now - s.since > 1600) {
            s.subject = null
          }
        }
        const subject = at(s.subject) ?? (sim.phase === 'dawn' ? at(sim.focusId) : undefined)
        if (subject) {
          want.copy(subject)
          distance = sim.phase === 'vote' ? 13 : 10
        }
      }
    }
    want.y = 1

    // Move what the camera looks at, and carry the camera along at the same angle.
    offset.subVectors(camera.position, controls.target)
    const length = MathUtils.damp(offset.length(), distance, 2.2, delta)
    controls.target.set(
      MathUtils.damp(controls.target.x, want.x, 2.6, delta),
      MathUtils.damp(controls.target.y, want.y, 2.6, delta),
      MathUtils.damp(controls.target.z, want.z, 2.6, delta),
    )
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), length)
    controls.update()

    if (s.returning && Math.abs(length - WIDE) < 0.2 && controls.target.distanceTo(HOME) < 0.2) s.returning = false
  })

  return null
}
