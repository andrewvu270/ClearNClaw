import type { SubTask } from '../types'

/**
 * Calculates the progress ratio for a list of sub-tasks.
 * Returns completed / total, or 0 if the list is empty.
 */
export function calculateProgress(subTasks: SubTask[]): number {
  if (subTasks.length === 0) return 0
  const completed = subTasks.filter(st => st.completed).length
  return completed / subTasks.length
}
