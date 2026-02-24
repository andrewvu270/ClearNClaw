import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useState, useEffect } from 'react'

interface CardRotateProps {
  children: React.ReactNode
  onSendToBack: () => void
  sensitivity: number
}

function CardRotate({ children, onSendToBack, sensitivity }: CardRotateProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useTransform(y, [-100, 100], [60, -60])
  const rotateY = useTransform(x, [-100, 100], [-60, 60])

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
      onSendToBack()
    } else {
      x.set(0)
      y.set(0)
    }
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab"
      style={{ x, y, rotateX, rotateY }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: 'grabbing' }}
      onDragEnd={handleDragEnd}
    >
      {children}
    </motion.div>
  )
}

interface StackCardsProps {
  cards: React.ReactNode[]
  onCardChange?: (index: number) => void
  sensitivity?: number
  randomRotation?: boolean
}

export function StackCards({
  cards,
  onCardChange,
  sensitivity = 200,
  randomRotation = false,
}: StackCardsProps) {
  const [stack, setStack] = useState(() =>
    cards.map((content, i) => ({ id: i, content }))
  )

  useEffect(() => {
    setStack(cards.map((content, i) => ({ id: i, content })))
  }, [cards])

  const sendToBack = (id: number) => {
    setStack(prev => {
      const next = [...prev]
      const idx = next.findIndex(c => c.id === id)
      const [card] = next.splice(idx, 1)
      next.unshift(card)
      // notify parent which card is now on top
      const topCard = next[next.length - 1]
      onCardChange?.(topCard.id)
      return next
    })
  }

  return (
    <div className="relative w-full h-full" style={{ perspective: 600 }}>
      {stack.map((card, index) => {
        const randomRotate = randomRotation ? Math.random() * 10 - 5 : 0
        return (
          <CardRotate
            key={card.id}
            onSendToBack={() => sendToBack(card.id)}
            sensitivity={sensitivity}
          >
            <motion.div
              className="rounded-2xl overflow-hidden w-full h-full"
              animate={{
                rotateZ: (stack.length - index - 1) * 4 + randomRotate,
                scale: 1 + index * 0.06 - stack.length * 0.06,
                transformOrigin: '90% 90%',
              }}
              initial={false}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              {card.content}
            </motion.div>
          </CardRotate>
        )
      })}
    </div>
  )
}
