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
  imageUrl: string
  rarity: string
}

export interface UserToy {
  id: string
  toyId: string
  toy: Toy
  wonAt: string
}
