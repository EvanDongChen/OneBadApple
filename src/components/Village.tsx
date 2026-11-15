import { RigidBody, CuboidCollider } from '@react-three/rapier'
import Campfire from './Campfire'

const GROUND_RADIUS = 22
const HUT_COUNT = 8
const HUT_RING = 15

/** Static village: ground disc, a ring of huts and the central campfire. */
export default function Village() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[GROUND_RADIUS, 0.5, GROUND_RADIUS]} position={[0, -0.5, 0]} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[GROUND_RADIUS, 64]} />
          <meshStandardMaterial color="#7cc46a" />
        </mesh>
      </RigidBody>

      {Array.from({ length: HUT_COUNT }, (_, i) => {
        const angle = (i / HUT_COUNT) * Math.PI * 2
        return (
          <Hut
            key={i}
            position={[Math.cos(angle) * HUT_RING, 0, Math.sin(angle) * HUT_RING]}
            rotation={-angle + Math.PI / 2}
          />
        )
      })}

      <Campfire />
    </>
  )
}

function Hut({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[2.6, 2.2, 2.6]} />
        <meshStandardMaterial color="#e8d3a9" />
      </mesh>
      <mesh castShadow position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.3, 1.6, 4]} />
        <meshStandardMaterial color="#c0553d" />
      </mesh>
    </RigidBody>
  )
}
