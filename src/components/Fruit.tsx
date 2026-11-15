import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BallCollider, CylinderCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { Group, Mesh, Quaternion, Vector3 } from 'three'
import { fruitPositions, useSim } from '../sim/store'
import { LOOKS, ROLE_TAG } from './fruitLooks'
import RichText from './RichText'

// Body
const RADIUS = 0.55
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
const EYE_SPREAD = 0.085
const MOUTH_SHAPES = 5
const MOUTH_HOLD_MIN = 0.08 // seconds each shape is held
const MOUTH_HOLD_JITTER = 0.08

// Arms: two-segment floppy sticks, simulated as a damped verlet chain.
const ARM_SEGMENT = 0.3
const ARM_DRAG = 0.94
const ARM_GRAVITY = 12
const LIMB_COLOR = '#151515'

// A chopped fruit falls apart into these horizontal slices. Angles are measured
// down from the top of the sphere, in radians; the face rides on the third slice.
const SLICE_CUTS = [0, 0.96, 1.36, 1.95, Math.PI]
const FACE_SLICE = 2

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

export default function Fruit({ id }: { id: string }) {
  // Keep the last known state so a fruit removed from the roster can still render its final frame.
  const live = useSim((s) => s.fruits.find((f) => f.id === id))
  const lastKnown = useRef(live)
  if (live) lastKnown.current = live
  const fruit = lastKnown.current!
  const speechText = useSim((s) => s.speech[id])
  const thinking = useSim((s) => s.thinking[id])
  const showRole = useSim((s) => s.screen === 'game' && (s.revealRoles || !s.fruits.find((f) => f.id === id)?.alive))
  const whispering = useSim((s) => s.phase === 'mingle')
  const armed = useSim((s) => s.attack?.attackerId === id)
  const striking = useSim((s) => s.attack?.attackerId === id && s.attack.striking)
  // Set when the fruit is chopped: where the whole body was, so the slices can take its place.
  const [chop, setChop] = useState<{ position: [number, number, number]; quaternion: [number, number, number, number] } | null>(null)
  const knife = useRef<Group>(null)
  const { alive, kind } = fruit
  const look = LOOKS[kind]

  // Spawn point is fixed at mount so later layout changes walk the fruit instead of teleporting it.
  const [spawn] = useState<[number, number, number]>(() => [fruit.home[0], HOVER_HEIGHT, fruit.home[1]])

  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const overlay = useRef<Group>(null)
  const mouthMeshes = useRef<(Mesh | null)[]>([])
  const mouthShape = useRef(0)
  const mouthTimer = useRef(0)
  const armMeshes = useRef<(Mesh | null)[]>([null, null, null, null])
  // Per arm: [elbow, hand]. Seeded on the first frame once the body position is known.
  const arms = useRef<ArmPoint[][] | null>(null)
  const legMeshes = useRef<(Mesh | null)[]>([null, null])
  const footMeshes = useRef<(Mesh | null)[]>([null, null])
  const feet = useRef<Foot[]>([makeFoot(spawn[0] - FOOT_SPREAD, spawn[2]), makeFoot(spawn[0] + FOOT_SPREAD, spawn[2])])
  const waddlePhase = useRef(Math.random() * Math.PI * 2)
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
    if (useSim.getState().phase !== 'vote') {
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
    const out = Math.hypot(t.x, t.z) || 1
    b.applyImpulse({ x: (t.x / out) * m * 7, y: m * 10, z: (t.z / out) * m * 7 }, true)
    b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 3, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * m * 3 }, true)
  }, [alive])

  useBeforePhysicsStep(() => {
    const b = body.current
    if (!b) return
    const sim = useSim.getState()
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
    const heightError = HOVER_HEIGHT - t.y
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
    // The attacking wolf moves at double speed, both on the way there and on the way home.
    const speed = WALK_SPEED * (sim.attack?.attackerId === id ? 2 : 1)
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
      waddlePhase.current += DT * 11
      v.torque.addScaledVector(v.fwd, Math.sin(waddlePhase.current) * WADDLE_TORQUE)
    }

    // Face the direction of travel; when standing, face who we walked up to,
    // else whoever is talking, else the centre.
    if (walking) {
      v.tmp.copy(v.want)
    } else {
      const focusId = sim.focusId !== id ? sim.focusId : null
      const focus = followPos ?? (focusId ? fruitPositions.get(focusId) : undefined)
      v.tmp.set((focus?.x ?? 0) - t.x, 0, (focus?.z ?? 0) - t.z)
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

    // Squash and stretch from vertical speed.
    if (visual.current) {
      const stretch = Math.max(-0.2, Math.min(0.2, lv.y * 0.05))
      visual.current.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5)
    }

    if (overlay.current) overlay.current.position.set(t.x, t.y + 1.15, t.z)

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
      v.shoulder.set(side * RADIUS * look.scale[0] * 0.93, 0, 0).applyQuaternion(v.quat).add(v.pos)
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

    // Legs. Alive: procedural stepping, a foot stays planted until the body drifts away
    // from it. Dead: the legs just stick out limply from the body.
    v.fwd.set(0, 0, 1).applyQuaternion(v.quat).setY(0)
    if (v.fwd.lengthSq() < 1e-4) v.fwd.set(0, 0, 1)
    v.fwd.normalize()
    v.right.set(v.fwd.z, 0, -v.fwd.x)

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
        foot.t = Math.min(1, foot.t + delta / STEP_TIME)
        foot.pos.lerpVectors(foot.from, foot.to, foot.t)
        foot.pos.y = FOOT_Y + Math.sin(foot.t * Math.PI) * STEP_LIFT
      }

      footMeshes.current[i]?.position.copy(foot.pos)
      placeLimb(legMeshes.current[i], v.hip, foot.pos)
    })
  })

  const faceZ = RADIUS * look.scale[2]

  return (
    <>
      <RigidBody ref={body} colliders={false} position={spawn} linearDamping={0.1} angularDamping={0.2}>
        <BallCollider args={[RADIUS]} friction={0.6} restitution={0.4} />
        <group ref={visual} visible={!chop}>
          <mesh castShadow scale={look.scale}>
            <sphereGeometry args={[RADIUS, 32, 24]} />
            <meshStandardMaterial color={look.color} roughness={0.45} />
          </mesh>
          <mesh castShadow position={[0, RADIUS * look.scale[1] + 0.06, 0]} rotation={[0, 0, 0.25]}>
            <cylinderGeometry args={[0.025, 0.035, 0.2, 6]} />
            <meshStandardMaterial color="#5a3a1c" />
          </mesh>
          <mesh castShadow position={[0.1, RADIUS * look.scale[1] + 0.1, 0]} rotation={[0, 0, -0.9]} scale={[1, 0.25, 0.55]}>
            <sphereGeometry args={[0.14, 12, 8]} />
            <meshStandardMaterial color="#3f9b3a" />
          </mesh>

          {/* Eyes: dots while alive, little crosses once dead. */}
          {[-1, 1].map((side, i) => (
            <group key={side} position={[side * EYE_SPREAD, 0.08 + eyeOffsets[i], faceZ * 0.97]}>
              <mesh visible={alive}>
                <sphereGeometry args={[EYE_RADIUS, 12, 12]} />
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

          {/* Flat mouth shapes, one visible at a time: line, short line, "o", open oval, open grin. */}
          <group position={[0, -0.06, faceZ + 0.006]}>
            {[
              <planeGeometry args={[0.15, 0.022]} />,
              <planeGeometry args={[0.08, 0.022]} />,
              <ringGeometry args={[0.028, 0.05, 20]} />,
              <circleGeometry args={[0.055, 20]} />,
              <circleGeometry args={[0.08, 20, Math.PI, Math.PI]} />,
            ].map((geometry, i) => (
              <mesh
                key={i}
                ref={(m) => void (mouthMeshes.current[i] = m)}
                visible={i === 0}
                scale={i === 3 ? [0.8, 1.1, 1] : 1}
                position={[0, i === 4 ? 0.03 : 0, 0]}
              >
                {geometry}
                <meshBasicMaterial color={LIMB_COLOR} />
              </mesh>
            ))}
          </group>
        </group>
      </RigidBody>

      {chop && <Slices look={look} position={chop.position} quaternion={chop.quaternion} />}

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
        <Html center zIndexRange={[10, 0]}>
          <div className={`fruit-tag${alive ? '' : ' dead'}`}>
            {speechText && alive && <div className={`bubble${whispering ? ' whisper' : ''}`}><RichText text={speechText} /></div>}
            {thinking && !speechText && <div className="bubble thinking"><i /><i /><i /></div>}
            <div className="name">
              {fruit.name}
              {showRole && <span className={`role ${fruit.role}`}>{ROLE_TAG[fruit.role]}</span>}
            </div>
          </div>
        </Html>
      </group>
    </>
  )
}

/**
 * A chopped fruit: horizontal slices, each its own rigid body, with skin on the
 * outside and pale flesh on the cut faces. They start stacked where the whole
 * fruit stood and are nudged apart so they topple onto the ground.
 */
function Slices({
  look,
  position,
  quaternion,
}: {
  look: (typeof LOOKS)[keyof typeof LOOKS]
  position: [number, number, number]
  quaternion: [number, number, number, number]
}) {
  // Random shove per slice, fixed for the life of the pieces.
  const kicks = useMemo(
    () =>
      SLICE_CUTS.slice(1).map(() => ({
        linear: [(Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3] as [number, number, number],
        angular: [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6] as [number, number, number],
      })),
    [],
  )

  return (
    <>
      {kicks.map((kick, i) => {
        const from = SLICE_CUTS[i]
        const to = SLICE_CUTS[i + 1]
        const top = RADIUS * Math.cos(from)
        const bottom = RADIUS * Math.cos(to)
        // Widest point of this slice: the equator if the slice spans it.
        const widest = RADIUS * (from < Math.PI / 2 && to > Math.PI / 2 ? 1 : Math.max(Math.sin(from), Math.sin(to)))
        return (
          <RigidBody
            key={i}
            colliders={false}
            position={position}
            quaternion={quaternion}
            linearVelocity={kick.linear}
            angularVelocity={kick.angular}
            linearDamping={0.3}
            angularDamping={0.8}
          >
            <CylinderCollider args={[((top - bottom) / 2) * look.scale[1], widest * 0.92]} position={[0, ((top + bottom) / 2) * look.scale[1], 0]} friction={0.9} restitution={0.2} />
            <group scale={look.scale}>
              <mesh castShadow>
                <sphereGeometry args={[RADIUS, 28, 6, 0, Math.PI * 2, from, to - from]} />
                <meshStandardMaterial color={look.color} roughness={0.45} />
              </mesh>
              {from > 0 && (
                <mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[RADIUS * Math.sin(from), 28]} />
                  <meshStandardMaterial color={look.flesh} roughness={0.6} />
                </mesh>
              )}
              {to < Math.PI && (
                <mesh position={[0, bottom, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[RADIUS * Math.sin(to), 28]} />
                  <meshStandardMaterial color={look.flesh} roughness={0.6} />
                </mesh>
              )}
              {i === 0 && (
                <mesh castShadow position={[0, RADIUS + 0.06, 0]} rotation={[0, 0, 0.25]}>
                  <cylinderGeometry args={[0.025, 0.035, 0.2, 6]} />
                  <meshStandardMaterial color="#5a3a1c" />
                </mesh>
              )}
              {/* The dead face, crosses for eyes, stays on its slice. */}
              {i === FACE_SLICE &&
                [-1, 1].map((side) =>
                  [1, -1].map((tilt) => (
                    <mesh key={`${side}${tilt}`} position={[side * EYE_SPREAD, 0.05, RADIUS]} rotation={[0, 0, (tilt * Math.PI) / 4]}>
                      <planeGeometry args={[0.1, 0.02]} />
                      <meshBasicMaterial color={LIMB_COLOR} />
                    </mesh>
                  )),
                )}
              {i === FACE_SLICE && (
                <mesh position={[0, -0.08, RADIUS * 0.99]}>
                  <planeGeometry args={[0.13, 0.022]} />
                  <meshBasicMaterial color={LIMB_COLOR} />
                </mesh>
              )}
            </group>
          </RigidBody>
        )
      })}
    </>
  )
}
