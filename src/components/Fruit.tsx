import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BallCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { Group, Mesh, Quaternion, Vector3 } from 'three'
import { fruitPositions, useSim } from '../sim/store'
import type { FruitDef, FruitKind } from '../sim/types'

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
const WALK_SPEED = 2.2
const WALK_GAIN = 6
const LEAN_GAIN = 1.5
const WADDLE_TORQUE = 9
const ARRIVE_DISTANCE = 0.35

// Legs
const HIP_SPREAD = 0.22
const FOOT_SPREAD = 0.28
const STEP_TRIGGER = 0.35
const STEP_TIME = 0.16
const STEP_LIFT = 0.25
const FOOT_Y = 0.07

const LOOKS: Record<FruitKind, { color: string; scale: [number, number, number] }> = {
  apple: { color: '#d8342c', scale: [1, 0.92, 1] },
  orange: { color: '#f08a1c', scale: [1, 0.95, 1] },
  lemon: { color: '#f2d43a', scale: [0.85, 0.9, 1.15] },
  plum: { color: '#6b3fa0', scale: [0.92, 1, 0.92] },
  pear: { color: '#a9c94a', scale: [0.9, 1.15, 0.9] },
  lime: { color: '#58b033', scale: [0.9, 0.88, 1.05] },
}

const UP = new Vector3(0, 1, 0)
const DT = 1 / 60

// Mouth: vertical scale when shut, and how far it flaps open while talking.
const MOUTH_CLOSED = 0.18
const MOUTH_FLAP = 1.1

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

export default function Fruit({ def }: { def: FruitDef }) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const overlay = useRef<Group>(null)
  const mouth = useRef<Mesh>(null)
  const mouthOpen = useRef(MOUTH_CLOSED)
  const legMeshes = useRef<(Mesh | null)[]>([null, null])
  const footMeshes = useRef<(Mesh | null)[]>([null, null])
  const feet = useRef<Foot[]>([
    makeFoot(def.home[0] - FOOT_SPREAD, def.home[1]),
    makeFoot(def.home[0] + FOOT_SPREAD, def.home[1]),
  ])
  const waddlePhase = useRef(Math.random() * Math.PI * 2)

  const speechText = useSim((s) => (s.speech?.speakerId === def.id ? s.speech.text : null))
  const look = LOOKS[def.kind]

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
      quat: new Quaternion(),
    }),
    [],
  )

  useEffect(() => {
    fruitPositions.set(def.id, new Vector3(def.home[0], HOVER_HEIGHT, def.home[1]))
    return () => {
      fruitPositions.delete(def.id)
    }
  }, [def])

  // A little hop when this fruit starts talking.
  useEffect(() => {
    const b = body.current
    if (!speechText || !b) return
    const m = b.mass()
    b.applyImpulse({ x: 0, y: m * 3.5, z: 0 }, true)
    b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 0.5, y: 0, z: (Math.random() - 0.5) * m * 0.5 }, true)
  }, [speechText])

  useBeforePhysicsStep(() => {
    const b = body.current
    if (!b) return
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

    // Walk toward the seat.
    v.want.set(def.seat[0] - t.x, 0, def.seat[1] - t.z)
    const distance = v.want.length()
    const walking = distance > ARRIVE_DISTANCE
    if (walking) v.want.multiplyScalar(WALK_SPEED / distance)
    else v.want.set(0, 0, 0)
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

    // Face the direction of travel; when standing, face whoever is talking (or the fire).
    if (walking) {
      v.tmp.copy(v.want)
    } else {
      const speakerId = useSim.getState().speech?.speakerId
      const focus = speakerId && speakerId !== def.id ? fruitPositions.get(speakerId) : undefined
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

  useFrame((state, delta) => {
    const b = body.current
    if (!b) return
    const t = b.translation()
    const lv = b.linvel()
    const r = b.rotation()
    v.pos.set(t.x, t.y, t.z)
    v.vel.set(lv.x, 0, lv.z)
    v.quat.set(r.x, r.y, r.z, r.w)
    fruitPositions.get(def.id)?.copy(v.pos)

    // Squash and stretch from vertical speed.
    if (visual.current) {
      const stretch = Math.max(-0.2, Math.min(0.2, lv.y * 0.05))
      visual.current.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5)
    }

    if (overlay.current) overlay.current.position.set(t.x, t.y + 1.15, t.z)

    // Mouth flaps while talking: two mixed sines so it doesn't look metronomic.
    if (mouth.current) {
      const time = state.clock.elapsedTime
      const target = speechText
        ? MOUTH_CLOSED + MOUTH_FLAP * Math.abs(Math.sin(time * 13) * 0.65 + Math.sin(time * 7.3) * 0.35)
        : MOUTH_CLOSED
      mouthOpen.current += (target - mouthOpen.current) * Math.min(1, delta * 25)
      mouth.current.scale.set(1, mouthOpen.current, 0.3)
    }

    // Procedural stepping: a foot stays planted until the body drifts away from it.
    v.fwd.set(0, 0, 1).applyQuaternion(v.quat).setY(0)
    if (v.fwd.lengthSq() < 1e-4) v.fwd.set(0, 0, 1)
    v.fwd.normalize()
    v.right.set(v.fwd.z, 0, -v.fwd.x)

    feet.current.forEach((foot, i) => {
      const side = i === 0 ? -1 : 1
      const other = feet.current[1 - i]
      v.tmp.copy(v.pos).addScaledVector(v.right, side * FOOT_SPREAD).addScaledVector(v.vel, 0.12).setY(FOOT_Y)

      if (foot.t >= 1) {
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

      // Stretch the leg cylinder between hip and foot.
      const leg = legMeshes.current[i]
      if (leg) {
        v.hip.set(side * HIP_SPREAD, -RADIUS * 0.75, 0).applyQuaternion(v.quat).add(v.pos)
        v.tmp.subVectors(foot.pos, v.hip)
        const length = v.tmp.length()
        leg.position.copy(v.hip).addScaledVector(v.tmp, 0.5)
        leg.quaternion.setFromUnitVectors(UP, v.tmp.divideScalar(length || 1))
        leg.scale.set(1, length, 1)
      }
    })
  })

  return (
    <>
      <RigidBody
        ref={body}
        colliders={false}
        position={[def.home[0], HOVER_HEIGHT, def.home[1]]}
        linearDamping={0.1}
        angularDamping={0.2}
      >
        <BallCollider args={[RADIUS]} friction={0.3} restitution={0.4} />
        <group ref={visual}>
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
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.17, 0.12, RADIUS * look.scale[2] * 0.93]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#1b1b1b" roughness={0.2} />
            </mesh>
          ))}
          <mesh ref={mouth} position={[0, -0.1, RADIUS * look.scale[2] * 0.95]} scale={[1, MOUTH_CLOSED, 0.3]}>
            <sphereGeometry args={[0.11, 16, 12]} />
            <meshStandardMaterial color="#3b0d12" roughness={0.6} />
          </mesh>
        </group>
      </RigidBody>

      {[0, 1].map((i) => (
        <group key={i}>
          <mesh ref={(m) => void (legMeshes.current[i] = m)} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 1, 8]} />
            <meshStandardMaterial color="#3a2a1e" />
          </mesh>
          <mesh ref={(m) => void (footMeshes.current[i] = m)} castShadow scale={[1, 0.6, 1.4]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color="#3a2a1e" />
          </mesh>
        </group>
      ))}

      <group ref={overlay}>
        <Html center zIndexRange={[10, 0]}>
          <div className="fruit-tag">
            {speechText && <div className="bubble">{speechText}</div>}
            <div className="name">{def.name}</div>
          </div>
        </Html>
      </group>
    </>
  )
}
