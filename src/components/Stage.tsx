import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Color, DoubleSide, MathUtils, Object3D } from 'three'
import type { AmbientLight, DirectionalLight, InstancedMesh } from 'three'
import { useSim } from '../sim/store'
import { LOOKS } from './fruitLooks'

const DAY = new Color('#ffffff')
const NIGHT = new Color('#1b1f2b')

/**
 * The whole setting, kept deliberately cheap: a blank backdrop, a grid floor,
 * flat markers for the meeting circle and each fruit's home, and two lights.
 * The backdrop and lights dim at night.
 */
export default function Stage() {
  const fruits = useSim((s) => s.fruits)
  const scene = useThree((s) => s.scene)
  const sun = useRef<DirectionalLight>(null)
  const ambient = useRef<AmbientLight>(null)
  const night = useRef(0)
  const backdrop = useRef(new Color('#ffffff'))

  useFrame((_, delta) => {
    const phase = useSim.getState().phase
    night.current = MathUtils.damp(night.current, phase === 'night' ? 1 : phase === 'dawn' ? 0.4 : 0, 2, delta)
    scene.background = backdrop.current.lerpColors(DAY, NIGHT, night.current)
    // During the winners' party the backdrop drifts through pastel colours.
    if (useSim.getState().party) backdrop.current.setHSL((performance.now() / 9000) % 1, 0.75, 0.92)
    if (sun.current) sun.current.intensity = MathUtils.lerp(1.6, 0.5, night.current)
    if (ambient.current) ambient.current.intensity = MathUtils.lerp(1.1, 0.45, night.current)
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={1.1} />
      <directionalLight
        ref={sun}
        position={[8, 16, 6]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-far={50}
      />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[200, 0.5, 200]} position={[0, -0.5, 0]} />
        {/* Invisible floor that only shows the shadows cast onto it. */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[80, 80]} />
          <shadowMaterial transparent opacity={0.22} />
        </mesh>
      </RigidBody>
      <Grid
        position={[0, 0.005, 0]}
        infiniteGrid
        cellSize={1}
        sectionSize={5}
        cellThickness={0.6}
        sectionThickness={1.1}
        cellColor="#d3d8df"
        sectionColor="#9aa4b2"
        fadeDistance={70}
        fadeStrength={1.5}
      />

      <Confetti />

      {/* Meeting circle. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.45, 2.6, 48]} />
        <meshBasicMaterial color="#9aa4b2" />
      </mesh>

      {/* Each fruit's home spot, in its colour. */}
      {fruits.map((f) => (
        <mesh key={f.id} rotation={[-Math.PI / 2, 0, 0]} position={[f.home[0], 0.01, f.home[1]]}>
          <ringGeometry args={[0.85, 1, 32]} />
          <meshBasicMaterial color={LOOKS[f.kind].color} />
        </mesh>
      ))}
    </>
  )
}

const CONFETTI_COUNT = 160
const CONFETTI_COLORS = ['#e2412f', '#f6b62e', '#4c9a3b', '#3d8fd6', '#7a52b3', '#ff6fa3']
const CONFETTI_TOP = 9

/** Paper confetti falling over the circle while the winners dance. One instanced mesh. */
function Confetti() {
  const active = useSim((s) => !!s.party)
  const mesh = useRef<InstancedMesh>(null)
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * 8
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, speed: 1.2 + Math.random() * 1.6, offset: Math.random() * CONFETTI_TOP, spin: 2 + Math.random() * 5 }
    }),
  )
  const dummy = useRef(new Object3D())

  useLayoutEffect(() => {
    if (!mesh.current) return
    const color = new Color()
    pieces.current.forEach((_, i) => mesh.current!.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length])))
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [active])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = clock.elapsedTime
    pieces.current.forEach((piece, i) => {
      const fall = (t * piece.speed + piece.offset) % CONFETTI_TOP
      dummy.current.position.set(piece.x + Math.sin(t + i) * 0.3, CONFETTI_TOP - fall, piece.z)
      dummy.current.rotation.set(t * piece.spin, t * piece.spin * 0.7, i)
      dummy.current.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.current.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  if (!active) return null
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI_COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.14, 0.22]} />
      <meshBasicMaterial side={DoubleSide} />
    </instancedMesh>
  )
}
