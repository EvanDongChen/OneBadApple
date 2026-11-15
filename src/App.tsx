import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Environment from './components/Environment'
import Village from './components/Village'
import Fruit from './components/Fruit'
import Hud from './components/Hud'
import SetupPanel from './components/SetupPanel'
import { useSim } from './sim/store'

export default function App() {
  const ids = useSim((s) => s.fruits.map((f) => f.id).join(','))
  const screen = useSim((s) => s.screen)

  return (
    <>
      <Canvas shadows camera={{ position: [0, 12, 21], fov: 42, near: 0.5, far: 600 }}>
        <Environment />
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <Village />
            {ids.split(',').map((id) => (
              <Fruit key={id} id={id} />
            ))}
          </Physics>
        </Suspense>
        <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={6} maxDistance={55} enablePan={false} />
      </Canvas>
      {screen === 'setup' ? <SetupPanel /> : <Hud />}
    </>
  )
}
