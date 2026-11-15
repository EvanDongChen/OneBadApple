import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Color, Object3D } from 'three'
import type { Group, InstancedMesh } from 'three'
import Campfire from './Campfire'
import { LOOKS, seededRandom } from './fruitLooks'
import { HUT_RING, useSim } from '../sim/store'

const ISLAND_RADIUS = 27
const PLAZA_RADIUS = 6.2
const TREE_COUNT = 46
const GRASS_COUNT = 900
const FLOWER_COUNT = 160
const ROCK_COUNT = 16
const CLOUD_COUNT = 8
const BENCH_COUNT = 6

const FLOWER_COLORS = ['#ff6fa3', '#ffd84d', '#ffffff', '#b98cff', '#ff8f4d']
const LEAF_COLORS = ['#3f9a44', '#4fae4a', '#2f8a4a', '#69b84f']

/** Random point in a ring around the village centre. */
function ringPoint(rand: () => number, min: number, max: number): [number, number] {
  const angle = rand() * Math.PI * 2
  const radius = Math.sqrt(min * min + rand() * (max * max - min * min))
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

/** The whole static setting: island, plaza, paths, huts, trees and dressing. */
export default function Village() {
  const fruits = useSim((s) => s.fruits)
  const hutAngles = fruits.map((_, i) => (i / fruits.length) * Math.PI * 2)

  return (
    <>
      <Island />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[PLAZA_RADIUS, 48]} />
        <meshStandardMaterial color="#dcbd8c" roughness={1} />
      </mesh>

      {fruits.map((fruit, i) => (
        <group key={fruit.id} rotation={[0, -hutAngles[i], 0]}>
          {/* Dirt path from the plaza to the hut door. */}
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[(PLAZA_RADIUS + HUT_RING) / 2 - 0.6, 0.02, 0]}>
            <planeGeometry args={[HUT_RING - PLAZA_RADIUS - 0.6, 1.5]} />
            <meshStandardMaterial color="#d2b283" roughness={1} />
          </mesh>
          <Hut roof={LOOKS[fruit.kind].color} />
        </group>
      ))}

      <Benches />
      <Lanterns />
      <Trees />
      <Rocks />
      <Grass />
      <Flowers />
      <Clouds />
      <Campfire />
    </>
  )
}

function Island() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[1, ISLAND_RADIUS]} position={[0, -1, 0]} />
      {/* Sea bed, so anything flung off the island comes to rest instead of falling forever. */}
      <CuboidCollider args={[200, 0.5, 200]} position={[0, -2.2, 0]} />
      <mesh receiveShadow position={[0, -1, 0]}>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS - 1.5, 2, 72]} />
        <meshStandardMaterial color="#7ec85f" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, -1.25, 0]}>
        <cylinderGeometry args={[ISLAND_RADIUS + 2.2, ISLAND_RADIUS + 3.5, 2, 72]} />
        <meshStandardMaterial color="#ecd9a0" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
        <circleGeometry args={[400, 64]} />
        <meshStandardMaterial color="#3fa7d6" roughness={0.25} metalness={0.1} transparent opacity={0.92} />
      </mesh>
    </RigidBody>
  )
}

/** A round cottage at the end of its path, facing the plaza. The roof matches its owner's colour. */
function Hut({ roof }: { roof: string }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[HUT_RING, 0, 0]}>
      <CylinderCollider args={[1.2, 1.7]} position={[0, 1.2, 0]} />
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <cylinderGeometry args={[1.6, 1.7, 2, 20]} />
        <meshStandardMaterial color="#f6ead2" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 2.9, 0]}>
        <coneGeometry args={[2.25, 1.9, 20]} />
        <meshStandardMaterial color={roof} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 3.95, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#5a3a1c" />
      </mesh>
      <mesh castShadow position={[0.7, 3.1, 0.7]}>
        <boxGeometry args={[0.35, 1, 0.35]} />
        <meshStandardMaterial color="#b8774f" />
      </mesh>
      {/* Door and windows face the plaza (-x). The windows glow, which shows at night. */}
      <mesh position={[-1.69, 0.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, 1.45]} />
        <meshStandardMaterial color="#7a4a25" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-1.3, 1.3, side * 1.02]} rotation={[0, -Math.PI / 2 + side * 0.66, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <meshStandardMaterial color="#ffe9a3" emissive="#ffc94d" emissiveIntensity={1.4} />
        </mesh>
      ))}
    </RigidBody>
  )
}

function Benches() {
  return (
    <>
      {Array.from({ length: BENCH_COUNT }, (_, i) => {
        const angle = ((i + 0.5) / BENCH_COUNT) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(angle) * 2.5, 0.2, Math.sin(angle) * 2.5]} rotation={[0, -angle, 0]}>
            <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 1.5, 10]} />
              <meshStandardMaterial color="#7a5230" roughness={1} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

function Lanterns() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <group key={i} position={[Math.cos(angle) * (PLAZA_RADIUS + 0.4), 0, Math.sin(angle) * (PLAZA_RADIUS + 0.4)]}>
            <mesh castShadow position={[0, 1.1, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 2.2, 8]} />
              <meshStandardMaterial color="#4a3a2c" />
            </mesh>
            <mesh position={[0, 2.35, 0]}>
              <sphereGeometry args={[0.2, 12, 10]} />
              <meshStandardMaterial color="#fff2c2" emissive="#ffc85a" emissiveIntensity={2.2} />
            </mesh>
            <pointLight position={[0, 2.35, 0]} color="#ffc878" intensity={5} distance={9} decay={1.8} />
          </group>
        )
      })}
    </>
  )
}

function Trees() {
  const trees = useMemo(() => {
    const rand = seededRandom(11)
    return Array.from({ length: TREE_COUNT }, () => ({
      spot: ringPoint(rand, HUT_RING + 4.2, ISLAND_RADIUS - 1.6),
      size: 0.8 + rand() * 0.9,
      color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
      pine: rand() < 0.35,
      turn: rand() * Math.PI,
    }))
  }, [])

  return (
    <>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.spot[0], 0, tree.spot[1]]} scale={tree.size} rotation={[0, tree.turn, 0]}>
          <mesh castShadow position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.18, 0.26, 1.6, 7]} />
            <meshStandardMaterial color="#77502e" roughness={1} />
          </mesh>
          {tree.pine ? (
            [0, 1, 2].map((tier) => (
              <mesh key={tier} castShadow position={[0, 1.7 + tier * 0.8, 0]}>
                <coneGeometry args={[1.25 - tier * 0.3, 1.3, 8]} />
                <meshStandardMaterial color={tree.color} flatShading roughness={0.9} />
              </mesh>
            ))
          ) : (
            <>
              <mesh castShadow position={[0, 2.4, 0]}>
                <icosahedronGeometry args={[1.25, 1]} />
                <meshStandardMaterial color={tree.color} flatShading roughness={0.9} />
              </mesh>
              <mesh castShadow position={[0.7, 1.9, 0.3]}>
                <icosahedronGeometry args={[0.75, 1]} />
                <meshStandardMaterial color={tree.color} flatShading roughness={0.9} />
              </mesh>
              <mesh castShadow position={[-0.6, 2, -0.4]}>
                <icosahedronGeometry args={[0.8, 1]} />
                <meshStandardMaterial color={tree.color} flatShading roughness={0.9} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </>
  )
}

function Rocks() {
  const rocks = useMemo(() => {
    const rand = seededRandom(23)
    return Array.from({ length: ROCK_COUNT }, () => ({
      spot: ringPoint(rand, PLAZA_RADIUS + 1.5, ISLAND_RADIUS - 1),
      size: 0.25 + rand() * 0.5,
      turn: [rand() * 3, rand() * 3, rand() * 3] as [number, number, number],
    }))
  }, [])
  return (
    <>
      {rocks.map((rock, i) => (
        <mesh key={i} castShadow receiveShadow position={[rock.spot[0], rock.size * 0.35, rock.spot[1]]} rotation={rock.turn} scale={[rock.size, rock.size * 0.7, rock.size]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#9a9da3" flatShading roughness={1} />
        </mesh>
      ))}
    </>
  )
}

/** Hundreds of little grass blades, drawn as one instanced mesh. */
function Grass() {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const rand = seededRandom(31)
    const dummy = new Object3D()
    const color = new Color()
    for (let i = 0; i < GRASS_COUNT; i++) {
      const [x, z] = ringPoint(rand, PLAZA_RADIUS + 0.4, ISLAND_RADIUS - 0.8)
      const height = 0.18 + rand() * 0.25
      dummy.position.set(x, height / 2, z)
      dummy.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4)
      dummy.scale.set(1, height / 0.3, 1)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
      mesh.current.setColorAt(i, color.setHSL(0.27 + rand() * 0.06, 0.55, 0.38 + rand() * 0.14))
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, GRASS_COUNT]} receiveShadow>
      <coneGeometry args={[0.07, 0.3, 4]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  )
}

function Flowers() {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const rand = seededRandom(47)
    const dummy = new Object3D()
    const color = new Color()
    for (let i = 0; i < FLOWER_COUNT; i++) {
      const [x, z] = ringPoint(rand, PLAZA_RADIUS + 0.6, ISLAND_RADIUS - 1)
      dummy.position.set(x, 0.16 + rand() * 0.1, z)
      dummy.scale.setScalar(0.7 + rand() * 0.7)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
      mesh.current.setColorAt(i, color.set(FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)]))
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FLOWER_COUNT]}>
      <icosahedronGeometry args={[0.09, 0]} />
      <meshStandardMaterial roughness={0.6} flatShading />
    </instancedMesh>
  )
}

/** Puffy clouds that drift slowly around the island. */
function Clouds() {
  const group = useRef<Group>(null)
  const clouds = useMemo(() => {
    const rand = seededRandom(59)
    return Array.from({ length: CLOUD_COUNT }, () => ({
      spot: ringPoint(rand, 18, 55),
      height: 15 + rand() * 9,
      size: 1.4 + rand() * 1.6,
      puffs: Array.from({ length: 4 }, (_, p) => ({ x: (p - 1.5) * 1.3 + rand() * 0.5, y: rand() * 0.5, r: 0.9 + rand() * 0.7 })),
    }))
  }, [])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.008
  })

  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <group key={i} position={[cloud.spot[0], cloud.height, cloud.spot[1]]} scale={cloud.size}>
          {cloud.puffs.map((puff, p) => (
            <mesh key={p} position={[puff.x, puff.y, 0]} scale={[puff.r, puff.r * 0.75, puff.r]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color="#ffffff" flatShading roughness={1} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
