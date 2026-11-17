import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BallCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { Color, DoubleSide, Group, Mesh, Quaternion, Vector3 } from 'three'
import type { MeshStandardMaterial } from 'three'
import type { FruitKind } from '../sim/types'
import { PARTY_BEAT_MS } from '../sim/sfx'
import { fruitPositions, fruitSpeeds, ghostPositions, useSim } from '../sim/store'
import { puff } from './Dust'
import Emote from './Emote'
import { ROLE_TAG } from './fruitLooks'
import { anchors, radiusAt, EYE_SPREAD, FruitBody, FruitSlices, LIMB_COLOR, RADIUS } from './fruitShapes'
import RichText from './RichText'

// Body
const HOVER_HEIGHT = 1.0 // body centre above the ground; the legs fill the gap
const GRAVITY = 20

// Tuning. Low damping ratios are what make it wobble.
const HOVER_STIFFNESS = 120
const HOVER_DAMPING = 6
const UPRIGHT_STIFFNESS = 60
const UPRIGHT_DAMPING = 3.5
const YAW_STIFFNESS = 40
const YAW_DAMPING = 8
const WALK_SPEED = 2.4
const WALK_GAIN = 6
const MAX_SPEED = 12 // fastest a fruit may go, however far the game is sped up
const BRAKE_GAIN = 4 // slow down this hard on the way in, so fast fruits don't overshoot
const LEAN_GAIN = 1.5
const WADDLE_TORQUE = 9
const ARRIVE_DISTANCE = 0.35
const FOLLOW_DISTANCE = 1.5
const CENTRE_KEEP_OUT = 2.6 // radius of the meeting circle fruits stand around, not in

// Legs
const HIP_SPREAD = 0.22
const FOOT_SPREAD = 0.28
const STEP_TRIGGER = 0.35
const STEP_TIME = 0.16
const STEP_LIFT = 0.25
const FOOT_Y = 0.07

// Face: tiny dot eyes and a flat 2D mouth that snaps between drawn shapes
// while talking, like animatic lip sync. Shape 0 is the resting line.
const EYE_RADIUS = 0.035
const MOUTH_SHAPES = 5 // shapes used for talking; one more, a frown, is kept for sulking
const FROWN = 5
const MOUTH_HOLD_MIN = 0.08 // seconds each shape is held
const MOUTH_HOLD_JITTER = 0.08

// Arms: two-segment floppy sticks, simulated as a damped verlet chain.
const ARM_SEGMENT = 0.3
const ARM_DRAG = 0.94
const ARM_GRAVITY = 12

// Mood marks, drawn flat on the face like a cartoon: pink hatching on the cheeks, a red
// "popping vein" on the brow, and blue gloom lines hanging down the forehead.
const BLUSH_COLOR = '#ff6f8a'
const VEIN_COLOR = '#e2412f'
const GLOOM_COLOR = '#4a6fd0'
const FLUSH = new Color('#ff2a1a')
const PALE = new Color('#d8ecff')
const RUN_DUST = 3.2 // running faster than this, for the game speed, kicks up dust at every step
const STREAK_SPEED = 3 // the wolf trails speed lines above this speed

const UP = new Vector3(0, 1, 0)
const DT = 1 / 60
const limbDir = new Vector3()

/** Stretch a unit-height cylinder so it spans from a to b. */
function placeLimb(mesh: Mesh | null, a: Vector3, b: Vector3) {
  if (!mesh) return
  limbDir.subVectors(b, a)
  const length = limbDir.length()
  mesh.position.copy(a).addScaledVector(limbDir, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, limbDir.divideScalar(length || 1))
  mesh.scale.set(1, length, 1)
}

interface ArmPoint {
  pos: Vector3
  prev: Vector3
}

interface Foot {
  pos: Vector3
  from: Vector3
  to: Vector3
  t: number // 1 = planted, <1 = mid-step
}

function makeFoot(x: number, z: number): Foot {
  const pos = new Vector3(x, FOOT_Y, z)
  return { pos, from: pos.clone(), to: pos.clone(), t: 1 }
}

/**
 * Where to stick a flat mark on the face: `x` across and `dy` up from the middle of the face,
 * pressed onto the skin of this particular fruit's shape and turned to face outward.
 */
function onSkin(kind: FruitKind, face: { y: number }, across: number, dy: number) {
  const y = face.y + dy
  // On a thin fruit, like the banana, marks are drawn in closer to the middle so they stay on the face.
  const x = Math.sign(across) * Math.min(Math.abs(across), radiusAt(kind, y) * 0.55)
  const r = Math.max(Math.abs(x) + 0.02, radiusAt(kind, y))
  // How much the skin leans back here, from how quickly the fruit narrows above this height.
  const slope = (radiusAt(kind, y - 0.03) - radiusAt(kind, y + 0.03)) / 0.06
  return {
    position: [x, y, Math.sqrt(r * r - x * x) + 0.014] as [number, number, number],
    rotation: [-Math.atan(slope), Math.asin(x / r), 0] as [number, number, number],
  }
}

export default function Fruit({ id }: { id: string }) {
  // Keep the last known state so a fruit removed from the roster can still render its final frame.
  const live = useSim((s) => s.fruits.find((f) => f.id === id))
  const lastKnown = useRef(live)
  if (live) lastKnown.current = live
  const fruit = lastKnown.current!
  const speechText = useSim((s) => s.speech[id])
  const thinking = useSim((s) => s.thinking[id])
  const showRole = useSim((s) => s.screen === 'game' && (s.revealRoles || !s.fruits.find((f) => f.id === id)?.alive))
  const showThought = useSim((s) => s.showThoughts && s.screen === 'game')
  // During the vote: who this fruit is pointing at, and how many are pointing at it.
  const pointAt = useSim((s) => s.votes[id])
  const votesAgainst = useSim((s) => Object.values(s.votes).filter((target) => target === id).length)
  const reaction = useSim((s) => s.reactions[id])
  // Carrying out the vote: this fruit holds the gun, and `firing` is the moment of the shot.
  const gunning = useSim((s) => s.execution?.shooterId === id)
  const firing = useSim((s) => s.execution?.shooterId === id && s.execution.firing)
  // The doctor's protection around this fruit, the moment the knife hits it, and the plaster left afterwards.
  const shielded = useSim((s) => s.shield?.id === id)
  const shieldHit = useSim((s) => s.shield?.id === id && s.shield.hit)
  const bandaged = useSim((s) => !!s.bandaged[id])
  /** This fruit is the wolf, and its knife has just bounced off the doctor's protection. */
  const repelled = useSim((s) => s.attack?.attackerId === id && s.shield?.id === s.attack.victimId && s.shield.hit)
  const armed = useSim((s) => s.attack?.attackerId === id)
  const striking = useSim((s) => s.attack?.attackerId === id && s.attack.striking)
  // Set when the fruit is chopped: where the whole body was, so the slices can take its place.
  const [chop, setChop] = useState<{ position: [number, number, number]; quaternion: [number, number, number, number] } | null>(null)
  const knife = useRef<Group>(null)
  const gun = useRef<Group>(null)
  const shield = useRef<Mesh>(null)
  const blushMarks = useRef<Group>(null)
  const veinMark = useRef<Group>(null)
  const gloomMarks = useRef<Group>(null)
  const streaks = useRef<Group>(null)
  /** The body's material, found once, for tinting the skin with mood. */
  const skin = useRef<MeshStandardMaterial | null>(null)
  const tint = useRef(0)
  /** Vertical speed last frame, for spotting the moment it lands. */
  const lastFall = useRef(0)
  const { alive, kind } = fruit
  // Where the face and arms sit on this fruit's particular shape.
  const face = useMemo(() => anchors(kind), [kind])

  // Spawn point is fixed at mount so later layout changes walk the fruit instead of teleporting it.
  const [spawn] = useState<[number, number, number]>(() => [fruit.home[0], HOVER_HEIGHT, fruit.home[1]])

  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const overlay = useRef<Group>(null)
  const mouthMeshes = useRef<(Mesh | null)[]>([])
  const eyeMeshes = useRef<(Mesh | null)[]>([])
  const browMeshes = useRef<(Mesh | null)[]>([])
  /** When this fruit next blinks, glances at its suspect, or (if it is a wolf) lets a smirk slip. */
  const tics = useRef({ blinkAt: 0, blinkEnd: 0, glanceAt: 3000 + Math.random() * 5000, glanceEnd: 0, smirkAt: 6000 + Math.random() * 9000, smirkEnd: 0 })
  /** Drama queens overreact: bigger jumps and bigger marks over their heads. */
  const dramatic = fruit.traits.quirks.includes('dramatic')
  const mouthShape = useRef(0)
  const mouthTimer = useRef(0)
  const armMeshes = useRef<(Mesh | null)[]>([null, null, null, null])
  // Per arm: [elbow, hand]. Seeded on the first frame once the body position is known.
  const arms = useRef<ArmPoint[][] | null>(null)
  const legMeshes = useRef<(Mesh | null)[]>([null, null])
  const footMeshes = useRef<(Mesh | null)[]>([null, null])
  const feet = useRef<Foot[]>([makeFoot(spawn[0] - FOOT_SPREAD, spawn[2]), makeFoot(spawn[0] + FOOT_SPREAD, spawn[2])])
  const waddlePhase = useRef(Math.random() * Math.PI * 2)
  /** Last beat of the party music this fruit hopped on. */
  const lastBeat = useRef(-1)
  const lastHop = useRef(-1)
  /** Puts each fruit's cheering hops slightly out of step with its neighbours'. */
  const hopOffset = useRef(Math.random())
  // Slightly uneven eyes make the face derpier.
  const eyeOffsets = useMemo(() => [(Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04], [])

  // Scratch vectors, reused every frame to avoid allocation.
  const v = useMemo(
    () => ({
      pos: new Vector3(),
      vel: new Vector3(),
      up: new Vector3(),
      fwd: new Vector3(),
      right: new Vector3(),
      want: new Vector3(),
      accel: new Vector3(),
      torque: new Vector3(),
      tmp: new Vector3(),
      hip: new Vector3(),
      shoulder: new Vector3(),
      quat: new Quaternion(),
    }),
    [],
  )

  useEffect(() => {
    fruitPositions.set(id, new Vector3(spawn[0], spawn[1], spawn[2]))
    return () => {
      fruitPositions.delete(id)
    }
  }, [id, spawn])

  // A little hop when this fruit starts talking.
  useEffect(() => {
    const b = body.current
    if (!speechText || !b || !alive) return
    const m = b.mass()
    b.applyImpulse({ x: 0, y: m * 3.5, z: 0 }, true)
    b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 0.5, y: 0, z: (Math.random() - 0.5) * m * 0.5 }, true)
  }, [speechText, alive])

  // A gasp: jump back from whatever everyone is staring at. Each fruit is a touch late or early.
  useEffect(() => {
    if (reaction !== 'gasp' || !alive) return
    const timer = setTimeout(() => {
      const b = body.current
      if (!b) return
      const m = b.mass()
      const r = b.rotation()
      v.tmp.set(0, 0, 1).applyQuaternion(v.quat.set(r.x, r.y, r.z, r.w))
      const flinch = dramatic ? 1.6 : 1
      b.applyImpulse({ x: -v.tmp.x * m * 1.8 * flinch, y: m * 3.6 * flinch, z: -v.tmp.z * m * 1.8 * flinch }, true)
      b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 0.6, y: 0, z: (Math.random() - 0.5) * m * 0.6 }, true)
    }, Math.random() * 220)
    return () => clearTimeout(timer)
  }, [reaction, alive])

  // The gun kicks the shooter back.
  useEffect(() => {
    const b = body.current
    const targetId = useSim.getState().execution?.targetId
    const target = targetId ? fruitPositions.get(targetId) : undefined
    if (!firing || !b || !target) return
    const t = b.translation()
    const d = Math.hypot(target.x - t.x, target.z - t.z) || 1
    const m = b.mass()
    b.applyImpulse({ x: (-(target.x - t.x) / d) * m * 2.2, y: m * 1.5, z: (-(target.z - t.z) / d) * m * 2.2 }, true)
  }, [firing])

  // The wolf is thrown back when its knife hits the doctor's protection.
  useEffect(() => {
    const b = body.current
    const victimId = useSim.getState().attack?.victimId
    const victim = victimId ? fruitPositions.get(victimId) : undefined
    if (!repelled || !b || !victim) return
    const t = b.translation()
    const d = Math.hypot(victim.x - t.x, victim.z - t.z) || 1
    const m = b.mass()
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
    b.applyImpulse({ x: (-(victim.x - t.x) / d) * m * 6, y: m * 5, z: (-(victim.z - t.z) / d) * m * 6 }, true)
    b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 2, y: 0, z: (Math.random() - 0.5) * m * 2 }, true)
  }, [repelled])

  // The wolf lunges at its victim when it strikes.
  useEffect(() => {
    const b = body.current
    const victimId = useSim.getState().attack?.victimId
    const victim = victimId ? fruitPositions.get(victimId) : undefined
    if (!striking || !b || !victim) return
    const t = b.translation()
    const d = Math.hypot(victim.x - t.x, victim.z - t.z) || 1
    const m = b.mass()
    b.applyImpulse({ x: ((victim.x - t.x) / d) * m * 4, y: m * 3, z: ((victim.z - t.z) / d) * m * 4 }, true)
  }, [striking])

  // Death. Voted out: balance is switched off and the fruit is flung away as a ragdoll.
  // Killed at night: the body is swapped for a stack of slices that fall apart.
  useEffect(() => {
    const b = body.current
    if (!b) return
    if (alive) {
      b.setEnabled(true)
      b.setLinearDamping(0.1)
      b.setAngularDamping(0.2)
      setChop(null)
      return
    }
    if (useSim.getState().chopped[id]) {
      const p = b.translation()
      const q = b.rotation()
      setChop({ position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] })
      b.setEnabled(false)
      return
    }
    b.setLinearDamping(0.6)
    b.setAngularDamping(1.2)
    const m = b.mass()
    const t = b.translation()
    // Shot: thrown straight back from the gun. Otherwise (the hunter's revenge) flung outward.
    const execution = useSim.getState().execution
    const shooter = execution?.targetId === id ? fruitPositions.get(execution.shooterId) : undefined
    const fromX = shooter ? t.x - shooter.x : t.x
    const fromZ = shooter ? t.z - shooter.z : t.z
    const out = Math.hypot(fromX, fromZ) || 1
    b.applyImpulse({ x: (fromX / out) * m * 7, y: m * 10, z: (fromZ / out) * m * 7 }, true)
    b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 3, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * m * 3 }, true)
  }, [alive])

  useBeforePhysicsStep(() => {
    const b = body.current
    if (!b) return
    const sim = useSim.getState()
    const moving = b.linvel()
    fruitSpeeds.set(id, Math.hypot(moving.x, moving.z))
    if (!sim.fruits.find((f) => f.id === id)?.alive) return // ragdoll: physics only

    const m = b.mass()
    const inertia = 0.4 * m * RADIUS * RADIUS
    const t = b.translation()
    const lv = b.linvel()
    const av = b.angvel()
    const r = b.rotation()
    v.quat.set(r.x, r.y, r.z, r.w)
    v.up.set(0, 1, 0).applyQuaternion(v.quat)
    v.fwd.set(0, 0, 1).applyQuaternion(v.quat).setY(0)
    if (v.fwd.lengthSq() < 1e-4) v.fwd.set(0, 0, 1)
    v.fwd.normalize()

    // Hover spring: holds the body up on its legs, with bounce. Only pushes, never pulls down.
    // A sulking fruit sags on its legs.
    const mood = sim.reactions[id]
    const heightError = HOVER_HEIGHT - (mood === 'sulk' ? 0.16 : 0) - t.y
    if (heightError > -0.2) {
      const lift = GRAVITY + HOVER_STIFFNESS * heightError - HOVER_DAMPING * lv.y
      if (lift > 0) b.applyImpulse({ x: 0, y: m * lift * DT, z: 0 }, true)
    }

    // Where to go: chase another fruit if told to, otherwise walk to the assigned spot.
    const followId = sim.follow[id]
    const followPos = followId ? fruitPositions.get(followId) : undefined
    const target = sim.targets[id]
    const goalX = followPos?.x ?? target?.[0] ?? t.x
    const goalZ = followPos?.z ?? target?.[1] ?? t.z
    v.want.set(goalX - t.x, 0, goalZ - t.z)
    const distance = v.want.length()
    const walking = distance > (followPos ? FOLLOW_DISTANCE : ARRIVE_DISTANCE)
    // Fruits walk faster when the game is sped up. The attacking wolf moves at double
    // speed, both on the way there and on the way home.
    const top = Math.min(MAX_SPEED, WALK_SPEED * sim.speed * (sim.attack?.attackerId === id ? 2 : 1))
    const left = distance - (followPos ? FOLLOW_DISTANCE : 0)
    const speed = Math.min(top, Math.max(WALK_SPEED * 0.5, left * BRAKE_GAIN))
    if (walking) v.want.multiplyScalar(speed / distance)
    else v.want.set(0, 0, 0)

    // Keep the middle of the meeting circle clear: pushed outward, and steered around it when walking past.
    const fromFire = Math.hypot(t.x, t.z)
    if (fromFire < CENTRE_KEEP_OUT && fromFire > 1e-3) {
      const ox = t.x / fromFire
      const oz = t.z / fromFire
      const strength = (CENTRE_KEEP_OUT - fromFire) * 4
      v.want.x += ox * strength
      v.want.z += oz * strength
      if (walking) {
        const side = -oz * v.want.x + ox * v.want.z >= 0 ? 1 : -1
        v.want.x -= oz * side * 1.5
        v.want.z += ox * side * 1.5
      }
    }

    v.accel.set((v.want.x - lv.x) * WALK_GAIN, 0, (v.want.z - lv.z) * WALK_GAIN)
    b.applyImpulse({ x: m * v.accel.x * DT, y: 0, z: m * v.accel.z * DT }, true)

    // Upright spring (under-damped), plus a lean into acceleration.
    v.torque.crossVectors(v.up, UP).multiplyScalar(UPRIGHT_STIFFNESS)
    v.torque.x -= av.x * UPRIGHT_DAMPING
    v.torque.z -= av.z * UPRIGHT_DAMPING
    v.torque.add(v.tmp.crossVectors(UP, v.accel).multiplyScalar(LEAN_GAIN))

    // Side-to-side waddle while walking.
    if (walking) {
      waddlePhase.current += DT * 11 * Math.min(2, sim.speed)
      v.torque.addScaledVector(v.fwd, Math.sin(waddlePhase.current) * WADDLE_TORQUE)
    }

    // Body language. Shaking: a nervous rattle. Sulking: head hung forward. Cheering: quick hops.
    if (mood === 'shake') {
      v.torque.x += (Math.random() - 0.5) * 90
      v.torque.z += (Math.random() - 0.5) * 90
    } else if (mood === 'sulk') {
      v.torque.add(v.tmp.crossVectors(UP, v.fwd).multiplyScalar(20))
    } else if (mood === 'cheer') {
      const hop = Math.floor(performance.now() / 380 + hopOffset.current)
      if (hop !== lastHop.current) {
        lastHop.current = hop
        b.applyImpulse({ x: 0, y: m * 3.8, z: 0 }, true)
      }
    }

    // Face the direction of travel; when standing, face who we walked up to,
    // else whoever is talking, else the centre.
    if (walking) {
      v.tmp.copy(v.want)
    } else {
      let lookId = sim.lookAt[id] ?? (sim.focusId !== id ? sim.focusId : null)
      // Crowd reactions. A fruit being accused draws every eye nearby...
      let nearest = 7
      let drawn = false
      for (const otherId in sim.reactions) {
        if (otherId === id || sim.reactions[otherId] !== 'shake') continue
        const p = fruitPositions.get(otherId)
        const d = p ? Math.hypot(p.x - t.x, p.z - t.z) : Infinity
        if (d < nearest) {
          nearest = d
          lookId = otherId
          drawn = true
        }
      }
      // ...and a fruit with nobody to talk to turns to watch anyone hurrying past.
      if (!drawn && !sim.lookAt[id] && sim.phase !== 'vote') {
        nearest = 4.5
        for (const [otherId, speed] of fruitSpeeds) {
          if (otherId === id || speed < 1.3) continue
          const p = fruitPositions.get(otherId)
          const d = p ? Math.hypot(p.x - t.x, p.z - t.z) : Infinity
          if (d < nearest) {
            nearest = d
            lookId = otherId
          }
        }
      }
      const focus = followPos ?? (lookId ? (lookId.startsWith('ghost:') ? ghostPositions.get(lookId.slice(6)) : fruitPositions.get(lookId)) : undefined)
      v.tmp.set((focus?.x ?? 0) - t.x, 0, (focus?.z ?? 0) - t.z)
    }
    // Dance party: hop on every beat, rock from side to side, and spin on the spot.
    const party = sim.party
    if (party && !walking && party.dancers.includes(id)) {
      const beat = (performance.now() - party.at) / PARTY_BEAT_MS
      const index = Math.floor(beat)
      if (index !== lastBeat.current) {
        lastBeat.current = index
        b.applyImpulse({ x: 0, y: m * 4.2, z: 0 }, true)
        v.torque.addScaledVector(v.fwd, (index % 2 ? 1 : -1) * 28)
      }
      const turn = beat * 1.3 + waddlePhase.current
      v.tmp.set(Math.sin(turn), 0, Math.cos(turn))
    }

    if (v.tmp.lengthSq() > 1e-4) {
      v.tmp.normalize()
      const yawError = Math.atan2(v.fwd.z * v.tmp.x - v.fwd.x * v.tmp.z, v.fwd.dot(v.tmp))
      v.torque.y += yawError * YAW_STIFFNESS - av.y * YAW_DAMPING
    }

    b.applyTorqueImpulse(
      { x: inertia * v.torque.x * DT, y: inertia * v.torque.y * DT, z: inertia * v.torque.z * DT },
      true,
    )
  })

  useFrame((_, delta) => {
    const b = body.current
    if (!b) return
    const t = b.translation()
    const lv = b.linvel()
    const r = b.rotation()
    v.pos.set(t.x, t.y, t.z)
    v.vel.set(lv.x, 0, lv.z)
    v.quat.set(r.x, r.y, r.z, r.w)
    fruitPositions.get(id)?.copy(v.pos)
    const party = useSim.getState().party
    const dancing = alive && !!party && party.dancers.includes(id)
    const beat = party ? (performance.now() - party.at) / PARTY_BEAT_MS : performance.now() / 190
    const mood = alive && !dancing ? reaction : undefined

    // Squash and stretch from vertical speed.
    if (visual.current) {
      const stretch = Math.max(-0.2, Math.min(0.2, lv.y * 0.05))
      visual.current.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5)
      // Shaking fruits also judder from side to side.
      visual.current.position.x = mood === 'shake' ? Math.sin(performance.now() * 0.09) * 0.035 : 0
    }

    if (overlay.current) overlay.current.position.set(t.x, t.y + 1.15, t.z)

    // Landing: a fall that has just stopped kicks up a puff of dust.
    if (!chop && lastFall.current < -2.5 && lv.y > lastFall.current + 1.5 && t.y < HOVER_HEIGHT + 0.35) {
      puff(t.x, t.z, Math.min(1.5, -lastFall.current / 5))
    }
    lastFall.current = lv.y

    // Speed lines streaming out behind the wolf as it hurries through the night.
    if (streaks.current) {
      const speed = Math.hypot(lv.x, lv.z)
      const show = armed && alive && speed > STREAK_SPEED
      streaks.current.visible = show
      if (show) {
        streaks.current.position.set(t.x, t.y, t.z)
        streaks.current.rotation.set(0, Math.atan2(lv.x, lv.z), 0)
        streaks.current.children.forEach((line, i) => {
          // Each line flickers in length so they read as rushing air.
          const length = (0.5 + speed * 0.14) * (0.6 + Math.random() * 0.6)
          line.scale.set(1, 1, length)
          line.position.z = -0.95 - length / 2 - (i % 2) * 0.2
        })
      }
    }

    // The doctor's bubble stays upright around the fruit, pulses gently, and flares when struck.
    if (shield.current) {
      shield.current.visible = !!shielded && alive
      shield.current.position.copy(v.pos)
      shield.current.scale.setScalar(shieldHit ? 1.22 + Math.sin(performance.now() * 0.06) * 0.05 : 1 + Math.sin(performance.now() * 0.004) * 0.04)
    }

    // Mouth: resting line when quiet; while talking, snap to a new shape every few frames.
    let shape = 0
    if (speechText && alive) {
      mouthTimer.current -= delta
      shape = mouthShape.current
      if (mouthTimer.current <= 0) {
        // Pick any shape other than the current one.
        shape = (shape + 1 + Math.floor(Math.random() * (MOUTH_SHAPES - 1))) % MOUTH_SHAPES
        mouthTimer.current = MOUTH_HOLD_MIN + Math.random() * MOUTH_HOLD_JITTER
      }
    } else {
      mouthTimer.current = 0
    }
    // Dancers and cheerers grin, gaspers gape, sulkers frown, and the accused's lip wobbles.
    if (!speechText) {
      if (dancing || mood === 'cheer') shape = 4
      else if (mood === 'gasp') shape = 3
      else if (mood === 'sulk') shape = FROWN
      else if (mood === 'shake') shape = Math.floor(performance.now() / 70) % 2
      else if (mood === 'puzzle') shape = 1
      // A grieving fruit's mouth stays turned down.
      else if (mood === 'blush') shape = 1
      else if (alive && !dancing && fruit.mood.grief > 0.5) shape = FROWN
    }
    // The face has a life of its own: it blinks, steals glances at whoever it trusts least,
    // and a werewolf lets a smirk slip now and then when it thinks nobody is looking.
    const now = performance.now()
    const tic = tics.current
    if (now > tic.blinkAt) {
      tic.blinkEnd = now + 110
      tic.blinkAt = now + 1800 + Math.random() * 4200
    }
    if (now > tic.glanceAt) {
      tic.glanceEnd = now + 750
      tic.glanceAt = now + 3000 + Math.random() * 5000
    }
    if (now > tic.smirkAt) {
      tic.smirkEnd = now + 700
      tic.smirkAt = now + 7000 + Math.random() * 8000
    }
    const calm = alive && !mood && !dancing
    const smirking = calm && !speechText && fruit.role === 'werewolf' && now < tic.smirkEnd
    let glance = 0
    if (calm && now < tic.glanceEnd) {
      const fruits = useSim.getState().fruits
      let suspect: string | undefined
      let lowest = -1
      for (const otherId in fruit.feelings) {
        const trust = fruit.feelings[otherId].trust
        if (trust < lowest && fruits.find((o) => o.id === otherId)?.alive) {
          lowest = trust
          suspect = otherId
        }
      }
      const at = suspect ? fruitPositions.get(suspect) : undefined
      // Which side of this fruit the suspect is standing on.
      if (at) glance = Math.sign(v.tmp.set(1, 0, 0).applyQuaternion(v.quat).dot(v.hip.subVectors(at, v.pos)))
    }
    // Mood on the face, cartoon style. Anger: a red flush and a popping vein. Fear, grief and
    // guilt: blue gloom lines down the forehead (and a pale face with fear). Flattered, smug
    // or delighted: pink hatching on the cheeks.
    const feel = fruit.mood
    const angry = alive && (feel.anger > 0.45 || !!gunning)
    const gloomy = alive && !angry && (mood === 'shake' || mood === 'sulk' || feel.fear > 0.5 || feel.grief > 0.45 || feel.guilt > 0.45)
    const pale = alive && !angry && (mood === 'shake' || mood === 'gasp' || feel.fear > 0.5)
    const blushing = alive && !angry && (mood === 'blush' || mood === 'cheer' || dancing || feel.smug > 0.45)
    if (blushMarks.current) blushMarks.current.visible = blushing
    if (veinMark.current) {
      veinMark.current.visible = angry
      veinMark.current.scale.setScalar(1 + Math.max(0, Math.sin(now * 0.012)) * 0.25)
    }
    if (gloomMarks.current) {
      gloomMarks.current.visible = gloomy
      gloomMarks.current.position.y = Math.sin(now * 0.003) * 0.006
    }
    if (!skin.current && visual.current) {
      visual.current.traverse((o) => {
        const material = (o as Mesh).material as MeshStandardMaterial | undefined
        if (!skin.current && material?.vertexColors) skin.current = material
      })
    }
    if (skin.current) {
      const want = angry ? 0.32 : pale ? 0.28 : blushing ? 0.1 : 0
      tint.current += (want - tint.current) * Math.min(1, delta * 4)
      skin.current.emissive.copy(angry ? FLUSH : pale ? PALE : FLUSH)
      skin.current.emissiveIntensity = tint.current
    }

    // Eyes go wide with shock or fear, droop when sulking, and close for a blink.
    eyeMeshes.current.forEach((mesh) => {
      if (!mesh) return
      if (mood === 'sulk') mesh.scale.set(1.1, 0.4, 1)
      else if (calm && now < tic.blinkEnd) mesh.scale.set(1.1, 0.12, 1)
      else mesh.scale.setScalar(mood === 'gasp' ? 1.8 : mood === 'shake' ? 1.35 : 1)
      mesh.position.x = glance * 0.026
    })
    // Eyebrows only show when there is a feeling to show: a scowl, worry, surprise, or the smirk.
    const brow =
      alive && (armed || gunning || (pointAt && speechText))
        ? 'angry'
        : mood === 'shake' || mood === 'sulk'
          ? 'worried'
          : mood === 'gasp' || mood === 'cheer' || mood === 'puzzle'
            ? 'raised'
            : smirking
              ? 'smirk'
              : // No reaction going on: whatever it has been feeling since yesterday shows instead.
                calm && fruit.mood.anger > 0.5
                ? 'angry'
                : calm && (fruit.mood.fear > 0.5 || fruit.mood.guilt > 0.5 || fruit.mood.grief > 0.5)
                  ? 'worried'
                  : null
    browMeshes.current.forEach((mesh, i) => {
      if (!mesh) return
      const side = i === 0 ? -1 : 1
      mesh.visible = !!brow
      mesh.rotation.z = brow === 'angry' ? side * 0.5 : brow === 'worried' ? -side * 0.4 : brow === 'smirk' ? (i === 1 ? -0.25 : 0.35) : 0
      mesh.position.y = 0.078 + (brow === 'raised' || (brow === 'smirk' && i === 1) ? 0.03 : brow === 'angry' ? -0.012 : 0)
    })
    // The smirk: the resting mouth tips up at one end.
    if (mouthMeshes.current[0]) mouthMeshes.current[0].rotation.z = smirking ? 0.38 : 0
    mouthShape.current = shape
    mouthMeshes.current.forEach((mesh, i) => {
      if (mesh) mesh.visible = i === shape
    })

    // Floppy arms: verlet points hanging off each shoulder, dragged around by the body.
    const dt = Math.min(delta, 1 / 30)
    if (!arms.current) {
      arms.current = [-1, 1].map(() =>
        [1, 2].map((n) => {
          const pos = v.pos.clone().setY(v.pos.y - ARM_SEGMENT * n)
          return { pos, prev: pos.clone() }
        }),
      )
    }
    arms.current.forEach((arm, i) => {
      const side = i === 0 ? -1 : 1
      v.shoulder.set(side * face.shoulderX * 0.93, face.y, 0).applyQuaternion(v.quat).add(v.pos)
      for (const point of arm) {
        v.tmp.subVectors(point.pos, point.prev).multiplyScalar(ARM_DRAG)
        point.prev.copy(point.pos)
        point.pos.add(v.tmp)
        point.pos.y -= ARM_GRAVITY * dt * dt
      }
      // The knife arm is held up and forward instead of dangling.
      if (armed && i === 1) {
        v.fwd.set(0, 0, 1).applyQuaternion(v.quat)
        arm[0].pos.lerp(v.tmp.copy(v.shoulder).addScaledVector(v.fwd, 0.26).addScaledVector(UP, 0.05), 0.5)
        arm[1].pos.lerp(v.tmp.copy(v.shoulder).addScaledVector(v.fwd, striking ? 0.6 : 0.4).addScaledVector(UP, striking ? 0.05 : 0.5), 0.5)
      }
      // Dancing, cheering or gasping: both arms in the air, pumping in turn with the beat.
      if (dancing || mood === 'cheer' || mood === 'gasp') {
        const pump = Math.sin(beat * Math.PI + i * Math.PI)
        v.tmp.set(side, 0, 0).applyQuaternion(v.quat)
        arm[0].pos.lerp(v.hip.copy(v.shoulder).addScaledVector(v.tmp, 0.22).addScaledVector(UP, 0.16), 0.5)
        arm[1].pos.lerp(v.hip.copy(v.shoulder).addScaledVector(v.tmp, 0.26 + pump * 0.1).addScaledVector(UP, 0.5 + pump * 0.12), 0.5)
      }
      // Voting: the right arm points straight at the chosen fruit.
      const pointed = alive && i === 1 && pointAt ? fruitPositions.get(pointAt) : undefined
      if (pointed) {
        v.tmp.subVectors(pointed, v.shoulder).setY(0).normalize()
        arm[0].pos.lerp(v.hip.copy(v.shoulder).addScaledVector(v.tmp, ARM_SEGMENT).addScaledVector(UP, 0.06), 0.6)
        arm[1].pos.lerp(v.hip.copy(v.shoulder).addScaledVector(v.tmp, ARM_SEGMENT * 2).addScaledVector(UP, 0.12), 0.6)
      }
      for (let pass = 0; pass < 3; pass++) {
        arm.forEach((point, n) => {
          const anchor = n === 0 ? v.shoulder : arm[0].pos
          v.tmp.subVectors(point.pos, anchor)
          if (v.tmp.lengthSq() < 1e-8) v.tmp.set(side, -1, 0)
          point.pos.copy(anchor).addScaledVector(v.tmp.normalize(), ARM_SEGMENT)
          // Keep the arm outside the body and above the ground.
          v.tmp.subVectors(point.pos, v.pos)
          if (v.tmp.length() < RADIUS * 1.06) point.pos.copy(v.pos).addScaledVector(v.tmp.normalize(), RADIUS * 1.06)
          if (point.pos.y < 0.03) point.pos.y = 0.03
        })
      }
      placeLimb(armMeshes.current[i * 2], v.shoulder, arm[0].pos)
      placeLimb(armMeshes.current[i * 2 + 1], arm[0].pos, arm[1].pos)
    })

    // Knife sits in the right hand, blade up (tipped forward on the strike).
    if (knife.current) {
      knife.current.visible = armed
      if (armed) {
        v.fwd.set(0, 0, 1).applyQuaternion(v.quat)
        knife.current.position.copy(arms.current[1][1].pos)
        knife.current.quaternion.setFromUnitVectors(UP, v.tmp.copy(UP).multiplyScalar(striking ? 0.2 : 1).addScaledVector(v.fwd, striking ? 1 : 0.35).normalize())
      }
    }

    // The gun sits in the right hand, which is already pointing at the condemned fruit.
    if (gun.current) {
      gun.current.visible = !!gunning && alive
      const targetId = useSim.getState().execution?.targetId
      const aim = targetId ? fruitPositions.get(targetId) : undefined
      if (gunning && aim) {
        gun.current.position.copy(arms.current[1][1].pos)
        gun.current.lookAt(aim.x, gun.current.position.y, aim.z)
      }
    }

    // Legs. Alive: procedural stepping, a foot stays planted until the body drifts away
    // from it. Dead: the legs just stick out limply from the body.
    v.fwd.set(0, 0, 1).applyQuaternion(v.quat).setY(0)
    if (v.fwd.lengthSq() < 1e-4) v.fwd.set(0, 0, 1)
    v.fwd.normalize()
    v.right.set(v.fwd.z, 0, -v.fwd.x)

    // Legs step quicker when the fruit is hurrying.
    const stride = Math.max(1, v.vel.length() / WALK_SPEED)
    feet.current.forEach((foot, i) => {
      const side = i === 0 ? -1 : 1
      const other = feet.current[1 - i]
      v.hip.set(side * HIP_SPREAD, -RADIUS * 0.75, 0).applyQuaternion(v.quat).add(v.pos)

      if (!alive) {
        foot.pos.set(side * HIP_SPREAD * 1.4, -RADIUS - 0.4, 0).applyQuaternion(v.quat).add(v.pos)
        foot.pos.y = Math.max(FOOT_Y, foot.pos.y)
        foot.t = 1
      } else if (foot.t >= 1) {
        v.tmp.copy(v.pos).addScaledVector(v.right, side * FOOT_SPREAD).addScaledVector(v.vel, 0.12).setY(FOOT_Y)
        const drift = foot.pos.distanceTo(v.tmp)
        if (drift > STEP_TRIGGER * 2.5 || (drift > STEP_TRIGGER && other.t >= 1)) {
          foot.from.copy(foot.pos)
          foot.to.copy(v.tmp).addScaledVector(v.vel, 0.12)
          foot.t = 0
        }
      } else {
        foot.t = Math.min(1, foot.t + (delta / STEP_TIME) * stride)
        // A running foot lands in a little puff of dust.
        if (foot.t >= 1 && v.vel.length() > RUN_DUST * useSim.getState().speed) puff(foot.to.x, foot.to.z, 0.35)
        foot.pos.lerpVectors(foot.from, foot.to, foot.t)
        foot.pos.y = FOOT_Y + Math.sin(foot.t * Math.PI) * STEP_LIFT
      }

      footMeshes.current[i]?.position.copy(foot.pos)
      placeLimb(legMeshes.current[i], v.hip, foot.pos)
    })
  })

  return (
    <>
      <RigidBody ref={body} colliders={false} position={spawn} linearDamping={0.1} angularDamping={0.2}>
        <BallCollider args={[RADIUS]} friction={0.6} restitution={0.4} />
        <group ref={visual} visible={!chop}>
          <FruitBody kind={kind} />

          {/* Eyes: dots while alive, little crosses once dead. */}
          {[-1, 1].map((side, i) => (
            <group key={side} position={[side * EYE_SPREAD, face.y + 0.08 + eyeOffsets[i], face.eyeZ * 0.985]}>
              <mesh visible={alive} ref={(m) => void (eyeMeshes.current[i] = m)}>
                <sphereGeometry args={[EYE_RADIUS, 12, 12]} />
                <meshBasicMaterial color={LIMB_COLOR} />
              </mesh>
              <mesh visible={false} ref={(m) => void (browMeshes.current[i] = m)} position={[0, 0.078, 0.014]}>
                <planeGeometry args={[0.09, 0.02]} />
                <meshBasicMaterial color={LIMB_COLOR} />
              </mesh>
              {[1, -1].map((tilt) => (
                <mesh key={tilt} visible={!alive} position={[0, 0, 0.03]} rotation={[0, 0, (tilt * Math.PI) / 4]}>
                  <planeGeometry args={[0.1, 0.02]} />
                  <meshBasicMaterial color={LIMB_COLOR} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Mood marks, drawn flat on the skin. */}
          <group ref={blushMarks} visible={false}>
            {[-1, 1].map((side) => (
              <group key={side} {...onSkin(kind, face, side * 0.17, -0.03)}>
                {[-1, 0, 1].map((n) => (
                  <mesh key={n} position={[n * 0.04, 0, 0]} rotation={[0, 0, 0.5]}>
                    <planeGeometry args={[0.022, 0.09]} />
                    <meshBasicMaterial color={BLUSH_COLOR} side={DoubleSide} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
          <group {...onSkin(kind, face, 0.2, 0.27)}>
            <group ref={veinMark} visible={false}>
              {/* Four little arcs bowing in toward each other: the cartoon popping vein. */}
              {(
                [
                  [1, 1, Math.PI],
                  [-1, 1, Math.PI * 1.5],
                  [-1, -1, 0],
                  [1, -1, Math.PI / 2],
                ] as const
              ).map(([x, y, start]) => (
                <mesh key={start} position={[x * 0.065, y * 0.065, 0]}>
                  <ringGeometry args={[0.04, 0.065, 12, 1, start, Math.PI / 2]} />
                  <meshBasicMaterial color={VEIN_COLOR} side={DoubleSide} />
                </mesh>
              ))}
            </group>
          </group>
          <group ref={gloomMarks} visible={false}>
            {[-0.16, -0.08, 0, 0.08, 0.16].map((x, i) => (
              <group key={x} {...onSkin(kind, face, x, 0.26)}>
                <mesh position={[0, -0.04 - (i % 2) * 0.02, 0]}>
                  <planeGeometry args={[0.024, 0.17 + (i % 2) * 0.05]} />
                  <meshBasicMaterial color={GLOOM_COLOR} side={DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>

          {/* A sticking plaster on the brow of a fruit that survived the knife. */}
          {bandaged && (
            <group position={[-0.16, face.y + 0.22, face.eyeZ * 0.9]} rotation={[-0.35, -0.3, 0.5]}>
              {[0, Math.PI / 2].map((turn) => (
                <mesh key={turn} rotation={[0, 0, turn]} position={[0, 0, turn ? 0.002 : 0]}>
                  <planeGeometry args={[0.2, 0.065]} />
                  <meshBasicMaterial color="#f1d9b0" side={DoubleSide} />
                </mesh>
              ))}
              <mesh position={[0, 0, 0.004]}>
                <planeGeometry args={[0.065, 0.065]} />
                <meshBasicMaterial color="#fffaf0" side={DoubleSide} />
              </mesh>
            </group>
          )}

          {/* Flat mouth shapes, one visible at a time: line, short line, "o", open oval, open grin, frown. */}
          <group position={[0, face.y - 0.06, face.mouthZ + 0.008]}>
            {[
              <planeGeometry args={[0.15, 0.022]} />,
              <planeGeometry args={[0.08, 0.022]} />,
              <ringGeometry args={[0.028, 0.05, 20]} />,
              <circleGeometry args={[0.055, 20]} />,
              <circleGeometry args={[0.08, 20, Math.PI, Math.PI]} />,
              <ringGeometry args={[0.05, 0.072, 20, 1, 0, Math.PI]} />,
            ].map((geometry, i) => (
              <mesh
                key={i}
                ref={(m) => void (mouthMeshes.current[i] = m)}
                visible={i === 0}
                scale={i === 3 ? [0.8, 1.1, 1] : 1}
                position={[0, i === 4 ? 0.03 : i === FROWN ? -0.045 : 0, 0]}
              >
                {geometry}
                <meshBasicMaterial color={LIMB_COLOR} />
              </mesh>
            ))}
          </group>
        </group>
      </RigidBody>

      {chop && <FruitSlices kind={kind} position={chop.position} quaternion={chop.quaternion} />}

      <group ref={knife} visible={false} scale={1.7}>
        <mesh castShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshStandardMaterial color="#5a3a1c" />
        </mesh>
        <mesh castShadow position={[0, 0.11, 0]}>
          <boxGeometry args={[0.04, 0.03, 0.16]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
        <mesh castShadow position={[0, 0.32, 0.01]}>
          <boxGeometry args={[0.02, 0.4, 0.11]} />
          <meshStandardMaterial color="#eef2f5" emissive="#aeb8c2" emissiveIntensity={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Speed lines behind the wolf. Each is a thin stick, stretched along its length each frame. */}
      <group ref={streaks} visible={false}>
        {(
          [
            [-0.32, 0.18],
            [0.3, 0.05],
            [-0.12, -0.2],
            [0.18, 0.32],
            [0.02, -0.02],
          ] as const
        ).map(([x, y]) => (
          <mesh key={x} position={[x, y, -1]}>
            <boxGeometry args={[0.035, 0.035, 1]} />
            <meshBasicMaterial color="#f4f6ff" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* The doctor's protection: a see-through bubble. */}
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={shieldHit ? '#eafff6' : '#6fe0bd'} transparent opacity={shieldHit ? 0.55 : 0.24} depthWrite={false} />
      </mesh>

      {/* The gun: barrel along its own forward axis, grip below, and a flash at the muzzle for the shot. */}
      <group ref={gun} visible={false} scale={1.6}>
        <mesh castShadow position={[0, 0.02, 0.1]}>
          <boxGeometry args={[0.05, 0.07, 0.3]} />
          <meshStandardMaterial color="#2b2f36" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, -0.07, -0.01]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.05, 0.14, 0.07]} />
          <meshStandardMaterial color="#5a3a1c" />
        </mesh>
        <mesh visible={!!firing} position={[0, 0.02, 0.36]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshBasicMaterial color="#ffd23f" />
        </mesh>
      </group>

      <group visible={!chop}>
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh ref={(m) => void (legMeshes.current[i] = m)} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 1, 8]} />
            <meshStandardMaterial color={LIMB_COLOR} />
          </mesh>
          <mesh ref={(m) => void (footMeshes.current[i] = m)} castShadow scale={[1, 0.6, 1.4]}>
            <sphereGeometry args={[0.06, 12, 10]} />
            <meshStandardMaterial color={LIMB_COLOR} />
          </mesh>
        </group>
      ))}

      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => void (armMeshes.current[i] = m)} castShadow>
          <cylinderGeometry args={[0.024, 0.024, 1, 8]} />
          <meshStandardMaterial color={LIMB_COLOR} />
        </mesh>
      ))}

      </group>

      <group ref={overlay}>
        {/* Once a fruit is dead its ghost carries the name tag instead. */}
        {alive && (
        <Html center zIndexRange={[10, 0]}>
          <div className="fruit-tag">
            {speechText && alive && (
              <div className="bubble">
                <RichText text={speechText} />
              </div>
            )}
            {thinking && !speechText && (
              <div className="bubble thinking">
                <i />
                <i />
                <i />
              </div>
            )}
            {showThought && alive && fruit.thought && !speechText && !thinking && (
              <div className="bubble thought">
                <RichText text={fruit.thought} />
              </div>
            )}
            {votesAgainst > 0 && alive && <div className="tally">{'✗'.repeat(votesAgainst)}</div>}
            <div className="name">
              {shielded && <span className="guard" title="Protected by the doctor tonight" />}
              {fruit.name}
              {showRole && <span className={`role ${fruit.role}`}>{ROLE_TAG[fruit.role]}</span>}
              {reaction && reaction !== 'blush' && <Emote reaction={reaction} big={dramatic} />}
            </div>
          </div>
        </Html>
        )}
      </group>
    </>
  )
}
