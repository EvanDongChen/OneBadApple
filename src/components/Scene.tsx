import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { useSim } from '../sim/store'
import Director, { INTRO_FROM } from './Director'
import Dust from './Dust'
import Fruit from './Fruit'
import Ghost from './Ghost'
import Stage from './Stage'
import SuspicionArrows from './SuspicionArrows'

/**
 * Everything drawn in 3D. This is the heavy part of the app (three.js and the physics
 * engine), so it is loaded separately and the page can show its interface first.
 */
export default function Scene() {
  const ids = useSim((s) => s.fruits.map((f) => f.id).join(','))
  const title = useSim((s) => s.screen === 'title')
  const ghosts = useSim((s) => (s.screen === 'game' ? s.fruits.filter((f) => !f.alive).map((f) => f.id).join(',') : ''))

  return (
    // dpr is capped so high-density screens don't render four times the pixels.
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: INTRO_FROM, fov: 42, near: 0.5, far: 300 }}>
      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]}>
          <Stage />
          {ids.split(',').map((id) => (
            <Fruit key={id} id={id} />
          ))}
        </Physics>
        {ghosts && ghosts.split(',').map((id) => <Ghost key={id} id={id} />)}
        <SuspicionArrows />
        <Dust />
      </Suspense>
      {/* The title screen turns slowly around the village. */}
      <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={6} maxDistance={55} enablePan={false} autoRotate={title} autoRotateSpeed={0.7} />
      <Director />
    </Canvas>
  )
}
