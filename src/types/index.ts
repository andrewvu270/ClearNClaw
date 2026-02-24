export interface BigTask {
  id: string
  userId: string
  name: string
  emoji: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  subTasks: SubTask[]
}

export interface SubTask {
  id: string
  bigTaskId: string
  name: string
  completed: boolean
  sortOrder: number
}

export interface UserProfile {
  id: string
  coins: number
  completedTasks: number
}

export interface Toy {
  id: string
  name: string
  group: string | null
  width: number
  height: number
  spriteNormal: string | null
  spriteGrabbed: string | null
  spriteCollected: string | null
  spriteWidth: number | null
  spriteHeight: number | null
  spriteTop: number | null
  spriteLeft: number | null
  mimeType: string | null
}

export interface UserToy {
  id: string
  userId: string
  toyId: string
  count: number
  createdAt: string
  updatedAt: string
  toy?: Toy
}
