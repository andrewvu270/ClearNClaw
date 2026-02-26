import type { BigTask } from '../types'

export interface GroupedTasks {
  planned: BigTask[]
  active: BigTask[]
  done: BigTask[]
}

/**
 * Groups tasks by completion status:
 * - Planned: 0 subtasks complete
 * - Active: some but not all subtasks complete
 * - Done: all subtasks complete or task.completed = true
 */
export function groupTasks(tasks: BigTask[]): GroupedTasks {
  const planned: BigTask[] = []
  const active: BigTask[] = []
  const done: BigTask[] = []

  for (const task of tasks) {
    if (task.completed) {
      done.push(task)
      continue
    }

    const completedCount = task.subTasks.filter(st => st.completed).length
    const totalCount = task.subTasks.length

    if (completedCount === 0) {
      planned.push(task)
    } else if (completedCount < totalCount) {
      active.push(task)
    } else {
      done.push(task)
    }
  }

  return { planned, active, done }
}
