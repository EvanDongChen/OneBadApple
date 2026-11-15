import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import { Color, Fog, MathUtils, Vector3 } from 'three'
import type { BoxGeometry, DirectionalLight, Group, HemisphereLight, Mesh, ShaderMaterial } from 'three'
import { useSim } from '../sim/store'

const DAY_FOG = new Color('#cfe9ff')
const NIGHT_FOG = new Color('#0a0f24')
const DAY_SUN = new Color('#fff0d0')
const NIGHT_SUN = new Color('#7d95ff')
const sunDir = new Vector3()

/** Sky, fog and lights. Everything blends between day and night as the game phase changes. */
export default function Environment() {
  const sky = useRef<Mesh<BoxGeometry, ShaderMaterial>>(null)
  const stars = useRef<Group>(null)
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const night = useRef(0)
  const scene = useThree((s) => s.scene)

  useFrame((_, delta) => {
    const phase = useSim.getState().phase
    const target = phase === 'night' ? 1 : phase === 'dawn' ? 0.45 : 0
    night.current = MathUtils.damp(night.current, target, 1.6, delta)
    const n = night.current

    // Sun arcs from mid-sky down to just under the horizon.
    const elevation = MathUtils.degToRad(MathUtils.lerp(38, -7, n))
    sunDir.set(Math.cos(elevation) * 0.75, Math.sin(elevation), Math.cos(elevation) * 0.5)
    const uniforms = sky.current?.material.uniforms
    uniforms?.sunPosition.value.copy(sunDir)

    if (sun.current) {
      sun.current.intensity = MathUtils.lerp(2.1, 0.35, n)
      sun.current.color.lerpColors(DAY_SUN, NIGHT_SUN, n)
    }
    if (hemi.current) hemi.current.intensity = MathUtils.lerp(0.95, 0.22, n)
    if (stars.current) stars.current.visible = n > 0.5
    if (!scene.fog) scene.fog = new Fog(DAY_FOG, 45, 130)
    scene.fog.color.lerpColors(DAY_FOG, NIGHT_FOG, n)
  })

  return (
    <>
      <Sky ref={sky} distance={4500} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <group ref={stars} visible={false}>
        <Stars radius={120} depth={40} count={2500} factor={5} fade speed={0.6} />
      </group>
      <hemisphereLight ref={hemi} args={['#dff1ff', '#6f9a4a', 0.95]} />
      <directionalLight
        ref={sun}
        position={[18, 24, 12]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-far={90}
      />
    </>
  )
}
