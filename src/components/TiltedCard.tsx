import { useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

const springValues = { damping: 30, stiffness: 150, mass: 1 }

interface TiltedCardProps {
  children: React.ReactNode
  containerHeight?: string
  containerWidth?: string
  scaleOnHover?: number
  rotateAmplitude?: number
}

export default function TiltedCard({
  children,
  containerHeight = '300px',
  containerWidth = '100%',
  scaleOnHover = 1.05,
  rotateAmplitude = 12,
}: TiltedCardProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const rotateX = useSpring(useMotionValue(0), springValues)
  const rotateY = useSpring(useMotionValue(0), springValues)
  const scale = useSpring(1, springValues)
  const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 })

  const applyTilt = useCallback((clientX: number, clientY: number) => {
    if (!innerRef.current) return
    const rect = innerRef.current.getBoundingClientRect()
    const offsetX = clientX - rect.left - rect.width / 2
    const offsetY = clientY - rect.top - rect.height / 2
    // Normalize to -1..1 range, clamp it
    const nx = Math.max(-1, Math.min(1, offsetX / (rect.width / 2)))
    const ny = Math.max(-1, Math.min(1, offsetY / (rect.height / 2)))
    rotateX.set(ny * -rotateAmplitude)
    rotateY.set(nx * rotateAmplitude)
    const px = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const py = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    setPointerPos({ x: px, y: py })
  }, [rotateAmplitude, rotateX, rotateY])

  const resetTilt = useCallback(() => {
    scale.set(1)
    rotateX.set(0)
    rotateY.set(0)
    setPointerPos({ x: 50, y: 50 })
  }, [scale, rotateX, rotateY])

  return (
    <div
      style={{
        height: containerHeight,
        width: containerWidth,
        perspective: '800px',
        // @ts-expect-error CSS custom properties
        '--pointer-x': `${pointerPos.x}%`,
        '--pointer-y': `${pointerPos.y}%`,
      }}
      className="flex items-center justify-center"
      onMouseMove={e => applyTilt(e.clientX, e.clientY)}
      onMouseEnter={() => scale.set(scaleOnHover)}
      onMouseLeave={resetTilt}
    >
      <motion.div
        ref={innerRef}
        style={{ rotateX, rotateY, scale, transformStyle: 'preserve-3d' }}
        className="touch-none"
        onTouchStart={e => {
          e.stopPropagation()
          e.preventDefault()
          if (!e.touches[0]) return
          scale.set(scaleOnHover)
          applyTilt(e.touches[0].clientX, e.touches[0].clientY)
        }}
        onTouchMove={e => {
          e.stopPropagation()
          e.preventDefault()
          if (!e.touches[0]) return
          applyTilt(e.touches[0].clientX, e.touches[0].clientY)
        }}
        onTouchEnd={e => {
          e.stopPropagation()
          resetTilt()
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
