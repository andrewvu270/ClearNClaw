import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

function FloatingPixel({ position, color, speed }: { position: [number, number, number]; color: string; speed: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * speed * 0.5
      meshRef.current.rotation.y += delta * speed * 0.3
    }
  })

  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={1.5}>
      <mesh ref={meshRef} position={position}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </Float>
  )
}

const pixels = [
  { position: [-2, 1, -3] as [number, number, number], color: '#00e5ff', speed: 1.2 },
  { position: [2.5, -1, -4] as [number, number, number], color: '#ff6b9d', speed: 0.8 },
  { position: [-1, -1.5, -2] as [number, number, number], color: '#39ff14', speed: 1.5 },
  { position: [1, 2, -5] as [number, number, number], color: '#ffe66d', speed: 1.0 },
  { position: [3, 0.5, -3] as [number, number, number], color: '#00e5ff', speed: 0.6 },
  { position: [-3, -0.5, -4] as [number, number, number], color: '#ff6b9d', speed: 1.1 },
]

export default function ThreeBackground() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#00e5ff" />
      <pointLight position={[-5, -5, 3]} intensity={0.3} color="#ff6b9d" />
      {pixels.map((p, i) => (
        <FloatingPixel key={i} {...p} />
      ))}
    </Canvas>
  )
}
