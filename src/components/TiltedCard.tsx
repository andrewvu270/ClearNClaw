import { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import './TiltedCard.css'

const springValues = { damping: 30, stiffness: 100, mass: 2 }

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
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useSpring(useMotionValue(0), springValues)
  const rotateY = useSpring(useMotionValue(0), springValues)
  const scale = useSpring(1, springValues)

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left - rect.width / 2
    const offsetY = e.clientY - rect.top - rect.height / 2
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude)
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude)
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover)
  }

  function handleMouseLeave() {
    scale.set(1)
    rotateX.set(0)
    rotateY.set(0)
  }

  // Touch support
  function handleTouch(e: React.TouchEvent) {
    if (!ref.current || !e.touches[0]) return
    const rect = ref.current.getBoundingClientRect()
    const offsetX = e.touches[0].clientX - rect.left - rect.width / 2
    const offsetY = e.touches[0].clientY - rect.top - rect.height / 2
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude)
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude)
  }

  function handleTouchEnd() {
    scale.set(1)
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <div
      ref={ref}
      style={{ height: containerHeight, width: containerWidth, perspective: '800px' }}
      className="flex items-center justify-center"
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouch}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        style={{ rotateX, rotateY, scale, transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </div>
  )
}
