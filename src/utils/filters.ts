import type { BigTask } from '../types'

/**
 * Returns Big Tasks that have at least one incomplete Sub-Task,
 * sorted by createdAt descending (newest first).
 */
export function getActiveTasks(tasks: BigTask[]): BigTask[] {
  return tasks
    .filter(task => task.subTasks.some(st => !st.completed))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Returns Big Tasks where all Sub-Tasks are marked complete,
 * sorted by completedAt descending (newest first).
 */
export function getDoneTasks(tasks: BigTask[]): BigTask[] {
  return tasks
    .filter(task => task.subTasks.length > 0 && task.subTasks.every(st => st.completed))
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bTime - aTime
    })
}
