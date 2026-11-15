import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import type { Group, Mesh, PointLight } from 'three'
import { seededRandom } from './fruitLooks'

const LOGS = 5
const STONES = 11
const EMBERS = 14

/** Central gathering spot: stone ring, logs, layered flames, rising embers and a flickering light. */
export default function Campfire() {
  const flames = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const embers = useRef<(Mesh | null)[]>([])
  const emberSeeds = useMemo(() => {
    const rand = seededRandom(7)
    return Array.from({ length: EMBERS }, () => ({ offset: rand() * 3, angle: rand() * Math.PI * 2, drift: 0.15 + rand() * 0.35, speed: 0.5 + rand() * 0.6 }))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.05
    flames.current?.scale.set(flicker, 1 + (flicker - 1) * 2.5, flicker)
    if (light.current) light.current.intensity = 26 * flicker
    embers.current.forEach((ember, i) => {
      if (!ember) return
      const seed = emberSeeds[i]
      const life = ((t * seed.speed + seed.offset) % 3) / 3
      ember.position.set(
        Math.cos(seed.angle + life * 2) * seed.drift * (0.4 + life),
        0.5 + life * 2.6,
        Math.sin(seed.angle + life * 2) * seed.drift * (0.4 + life),
      )
      ember.scale.setScalar(1 - life)
    })
  })

  return (
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[0.5, 0.85]} position={[0, 0.5, 0]} />

      {Array.from({ length: STONES }, (_, i) => {
        const angle = (i / STONES) * Math.PI * 2
        return (
          <mesh key={i} castShadow receiveShadow position={[Math.cos(angle) * 0.95, 0.1, Math.sin(angle) * 0.95]} rotation={[i, i * 2, i * 3]} scale={[1, 0.7, 1]}>
            <icosahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#8d8f94" flatShading />
          </mesh>
        )
      })}

      {Array.from({ length: LOGS }, (_, i) => {
        const angle = (i / LOGS) * Math.PI * 2
        return (
          <mesh key={i} castShadow position={[Math.cos(angle) * 0.4, 0.2, Math.sin(angle) * 0.4]} rotation={[0, -angle, Math.PI / 2.6]}>
            <cylinderGeometry args={[0.12, 0.12, 1.1, 8]} />
            <meshStandardMaterial color="#5c3a1e" />
          </mesh>
        )
      })}

      <group ref={flames} position={[0, 0.15, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <coneGeometry args={[0.42, 1.3, 9]} />
          <meshStandardMaterial color="#ff7a1a" emissive="#ff4d00" emissiveIntensity={2.2} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0.08, 0.5, 0.05]}>
          <coneGeometry args={[0.28, 0.95, 9]} />
          <meshStandardMaterial color="#ffc23d" emissive="#ffa200" emissiveIntensity={2.6} />
        </mesh>
        <mesh position={[-0.05, 0.4, -0.04]}>
          <coneGeometry args={[0.15, 0.6, 9]} />
          <meshStandardMaterial color="#fff3b0" emissive="#ffe27a" emissiveIntensity={3} />
        </mesh>
      </group>

      {emberSeeds.map((_, i) => (
        <mesh key={i} ref={(m) => void (embers.current[i] = m)}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshBasicMaterial color="#ffb347" />
        </mesh>
      ))}

      <pointLight ref={light} position={[0, 1.3, 0]} color="#ff9a3c" distance={20} decay={1.6} />
    </RigidBody>
  )
}
