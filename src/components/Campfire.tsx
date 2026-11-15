import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import type { Mesh, PointLight } from 'three'

const LOGS = 5

/** Central gathering spot. The flame and its light flicker a little each frame. */
export default function Campfire() {
  const flame = useRef<Mesh>(null)
  const light = useRef<PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.05
    if (flame.current) flame.current.scale.set(flicker, 1 + (flicker - 1) * 2.5, flicker)
    if (light.current) light.current.intensity = 14 * flicker
  })

  return (
    <RigidBody type="fixed" colliders="hull">
      {Array.from({ length: LOGS }, (_, i) => {
        const angle = (i / LOGS) * Math.PI * 2
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(angle) * 0.45, 0.18, Math.sin(angle) * 0.45]}
            rotation={[0, -angle, Math.PI / 2.6]}
          >
            <cylinderGeometry args={[0.13, 0.13, 1.2, 8]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
        )
      })}
      <mesh ref={flame} position={[0, 0.7, 0]}>
        <coneGeometry args={[0.38, 1.1, 10]} />
        <meshStandardMaterial color="#ff9a2e" emissive="#ff5a00" emissiveIntensity={2} />
      </mesh>
      <pointLight ref={light} position={[0, 1.2, 0]} color="#ffa14a" distance={14} />
    </RigidBody>
  )
}
