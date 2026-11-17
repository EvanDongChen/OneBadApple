import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { fruitPositions, useSim } from '../sim/store'

const WIDE = 24 // camera distance for the whole stage
const HOME = new Vector3(0, 1, 0)
/** The opening: the camera starts high up, looking down from the sky, and comes down to here. */
export const INTRO_FROM: [number, number, number] = [0, 46, 30]
const INTRO_TO = new Vector3(0, 12, 21)
const INTRO_MS = 2600
const SAME_GROUP = 3.5 // speakers this close to the current conversation are part of it
const MOVE_ON_MS = 2500 // how long a conversation must be silent before the camera leaves it

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
  const anchor = useMemo(() => new Vector3(), [])
  const shot = useRef({ subject: null as string | null, since: 0, wasGame: false, returning: false })

  // The scene is up: the title screen can start coming down out of the sky.
  useEffect(() => {
    useSim.setState({ sceneReady: true })
  }, [])

  useFrame((_, delta) => {
    if (!controls) return
    const sim = useSim.getState()
    // The opening descent, in step with the sky sliding away on the title screen.
    if (sim.screen === 'title') {
      const t = sim.introAt === null ? 0 : Math.min(1, (performance.now() - sim.introAt) / INTRO_MS)
      if (t < 1) {
        const eased = t * t * (3 - 2 * t)
        camera.position.set(INTRO_FROM[0], INTRO_FROM[1], INTRO_FROM[2]).lerp(INTRO_TO, eased)
        controls.update()
        return
      }
    }
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
        // Several groups talk at once. The camera picks one conversation and stays with it:
        // `anchor` is the spot where that conversation is happening. In the pause between two
        // lines it waits there for the next speaker in the same group, and only moves on to
        // another group once this one has been quiet for a while, which means it has finished.
        const speaking = s.subject && speakers.includes(s.subject) ? at(s.subject) : undefined
        if (speaking) {
          anchor.copy(speaking)
          s.since = now
        } else {
          const far = (id: string) => at(id)?.distanceTo(anchor) ?? Infinity
          const here = s.subject ? speakers.filter((id) => far(id) < SAME_GROUP) : []
          if (here.length) {
            s.subject = here[0]
          } else if (!s.subject || now - s.since > MOVE_ON_MS) {
            // Nothing to stay for: go to the nearest conversation still going, or pull back out.
            s.subject = speakers.length ? speakers.reduce((a, b) => (far(b) < far(a) ? b : a)) : null
            s.since = now
          }
          const next = at(s.subject)
          if (next && s.subject && speakers.includes(s.subject)) anchor.copy(next)
        }
        if (s.subject) {
          want.copy(anchor)
          distance = sim.phase === 'vote' ? 13 : 10
        } else {
          const body = sim.phase === 'dawn' ? at(sim.focusId) : undefined
          if (body) {
            want.copy(body)
            distance = 10
          }
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
    // Dev builds expose what the camera is looking at, so its behaviour can be measured.
    if (import.meta.env.DEV) Object.assign(window, { __cameraTarget: controls.target })

    if (s.returning && Math.abs(length - WIDE) < 0.2 && controls.target.distanceTo(HOME) < 0.2) s.returning = false
  })

  return null
}
