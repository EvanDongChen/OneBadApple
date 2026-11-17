import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import BubbleLayout from './components/BubbleLayout'
import Stage from './components/Stage'
import Fruit from './components/Fruit'
import Ghost from './components/Ghost'
import Hud from './components/Hud'
import SetupPanel from './components/SetupPanel'
import { useSim } from './sim/store'

export default function App() {
  const ids = useSim((s) => s.fruits.map((f) => f.id).join(','))
  const screen = useSim((s) => s.screen)
  const ghosts = useSim((s) => (s.screen === 'game' ? s.fruits.filter((f) => !f.alive).map((f) => f.id).join(',') : ''))

  return (
    <>
      {/* dpr is capped so high-density screens don't render four times the pixels. */}
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 12, 21], fov: 42, near: 0.5, far: 300 }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <Stage />
            {ids.split(',').map((id) => (
              <Fruit key={id} id={id} />
            ))}
          </Physics>
          {ghosts && ghosts.split(',').map((id) => <Ghost key={id} id={id} />)}
        </Suspense>
        <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={6} maxDistance={55} enablePan={false} />
      </Canvas>
      <BubbleLayout />
      {screen === 'setup' ? <SetupPanel /> : <Hud />}
    </>
  )
}
