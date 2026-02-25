import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

type ShapeType = 'coin' | 'star' | 'pill' | 'bolt' | 'knot' | 'check'

function FloatingShape({ position, color, speed, shape }: {
  position: [number, number, number]
  color: string
  speed: number
  shape: ShapeType
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * speed * 0.4
      groupRef.current.rotation.y += delta * speed * 0.3
    }
  })

  return (
    <Float speed={speed} rotationIntensity={0.6} floatIntensity={1.8}>
      <group ref={groupRef} position={position}>
        <ShapeGeometry shape={shape} color={color} />
      </group>
    </Float>
  )
}

function ShapeGeometry({ shape, color }: { shape: ShapeType; color: string }) {
  const mat = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />

  const starShape = useMemo(() => {
    const s = new THREE.Shape()
    const outerR = 0.35, innerR = 0.15, points = 5
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR
      const angle = (i * Math.PI) / points - Math.PI / 2
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    s.closePath()
    return s
  }, [])

  const boltShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0.05, 0.4)
    s.lineTo(-0.2, 0.05)
    s.lineTo(-0.05, 0.05)
    s.lineTo(-0.1, -0.4)
    s.lineTo(0.2, -0.02)
    s.lineTo(0.05, -0.02)
    s.closePath()
    return s
  }, [])

  const checkShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.25, 0.0)
    s.lineTo(-0.15, -0.1)
    s.lineTo(-0.05, 0.05)
    s.lineTo(0.25, -0.25)
    s.lineTo(0.3, -0.18)
    s.lineTo(-0.05, 0.2)
    s.closePath()
    return s
  }, [])

  const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }

  switch (shape) {
    case 'coin':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.08, 16, 32]} />
          {mat}
        </mesh>
      )
    case 'star':
      return (
        <mesh>
          <extrudeGeometry args={[starShape, extrudeSettings]} />
          {mat}
        </mesh>
      )
    case 'pill':
      return (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <capsuleGeometry args={[0.12, 0.3, 8, 16]} />
          {mat}
        </mesh>
      )
    case 'bolt':
      return (
        <mesh>
          <extrudeGeometry args={[boltShape, extrudeSettings]} />
          {mat}
        </mesh>
      )
    case 'knot':
      return (
        <mesh scale={0.15}>
          <torusKnotGeometry args={[1, 0.35, 64, 8, 2, 3]} />
          {mat}
        </mesh>
      )
    case 'check':
      return (
        <mesh>
          <extrudeGeometry args={[checkShape, { ...extrudeSettings, depth: 0.12 }]} />
          {mat}
        </mesh>
      )
    default:
      return null
  }
}

const items: { position: [number, number, number]; color: string; speed: number; shape: ShapeType }[] = [
  { position: [-3, 1.5, -4], color: '#ffe66d', speed: 0.8, shape: 'coin' },
  { position: [3.5, -1.5, -5], color: '#ff6b9d', speed: 1.0, shape: 'star' },
  { position: [-1.5, -2.5, -3.5], color: '#39ff14', speed: 1.2, shape: 'check' },
  { position: [1.5, 2.5, -6], color: '#00e5ff', speed: 0.7, shape: 'bolt' },
  { position: [4, 0.5, -4.5], color: '#ff6b9d', speed: 0.9, shape: 'knot' },
  { position: [-4, -1, -5], color: '#00e5ff', speed: 1.1, shape: 'pill' },
]

export default function ThreeBackground() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#00e5ff" />
      <pointLight position={[-5, -5, 3]} intensity={0.3} color="#ff6b9d" />
      {items.map((p, i) => (
        <FloatingShape key={i} {...p} />
      ))}
    </Canvas>
  )
}
