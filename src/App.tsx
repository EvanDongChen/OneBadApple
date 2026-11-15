import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Village from './components/Village'

export default function App() {
  return (
    <Canvas shadows camera={{ position: [0, 9, 16], fov: 45 }}>
      <Sky sunPosition={[40, 30, 20]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]}>
          <Village />
        </Physics>
      </Suspense>
      <OrbitControls
        target={[0, 1, 0]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={6}
        maxDistance={40}
      />
    </Canvas>
  )
}
