import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDemoTaskIfNeeded } from '../taskService'
import { supabase } from '../../lib/supabase'

// Mock the supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('createDemoTaskIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create demo task when user has zero big tasks', async () => {
    const userId = 'test-user-id'
    
    // Mock the count query to return 0
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 0,
        error: null,
      }),
    })
    
    // Mock the insert query for creating the task
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'demo-task-id',
            user_id: userId,
            name: '🎮 Build Your First Win',
            emoji: '🎮',
            energy_tag: 'low',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
          },
          error: null,
        }),
      }),
    })
    
    // Mock the sub-tasks insert
    const subTasksInsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: 'st1', big_task_id: 'demo-task-id', name: 'Press Start', emoji: '▶️', sort_order: 0, completed: false },
          { id: 'st2', big_task_id: 'demo-task-id', name: 'Complete 1 action', emoji: '✅', sort_order: 1, completed: false },
          { id: 'st3', big_task_id: 'demo-task-id', name: 'Win your first coin', emoji: '🪙', sort_order: 2, completed: false },
          { id: 'st4', big_task_id: 'demo-task-id', name: 'Play claw machine', emoji: '🕹️', sort_order: 3, completed: false },
        ],
        error: null,
      }),
    })
    
    // Setup the mock chain
    let callCount = 0
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'big_tasks') {
        callCount++
        if (callCount === 1) {
          // First call is the count query
          return {
            select: selectMock,
          } as any
        } else {
          // Second call is the insert
          return {
            insert: insertMock,
          } as any
        }
      } else if (table === 'sub_tasks') {
        return {
          insert: subTasksInsertMock,
        } as any
      }
      return {} as any
    })
    
    await createDemoTaskIfNeeded(userId)
    
    // Verify the count query was called
    expect(supabase.from).toHaveBeenCalledWith('big_tasks')
    expect(selectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    
    // Verify the task was created with correct properties
    expect(insertMock).toHaveBeenCalledWith({
      user_id: userId,
      name: 'Build Your First Win',
      emoji: '🎮',
      energy_tag: 'low',
    })
    
    // Verify sub-tasks were created
    expect(subTasksInsertMock).toHaveBeenCalledWith([
      { big_task_id: 'demo-task-id', name: 'Start a timer for your focus task', emoji: '⏱️', sort_order: 0 },
      { big_task_id: 'demo-task-id', name: 'Tap task or subtask name/emoji to edit', emoji: '✏️', sort_order: 1 },
      { big_task_id: 'demo-task-id', name: 'Complete all subtasks to earn coins & play claw machine', emoji: '🪙', sort_order: 2 },
    ])
  })

  it('should not create demo task when user already has tasks', async () => {
    const userId = 'test-user-id'
    
    // Mock the count query to return 1
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 1,
        error: null,
      }),
    })
    
    vi.mocked(supabase.from).mockReturnValue({
      select: selectMock,
    } as any)
    
    await createDemoTaskIfNeeded(userId)
    
    // Verify only the count query was called
    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalledWith('big_tasks')
    expect(selectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  })

  it('should throw error if count query fails', async () => {
    const userId = 'test-user-id'
    const error = new Error('Database error')
    
    // Mock the count query to return an error
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: null,
        error,
      }),
    })
    
    vi.mocked(supabase.from).mockReturnValue({
      select: selectMock,
    } as any)
    
    await expect(createDemoTaskIfNeeded(userId)).rejects.toThrow('Database error')
  })
})
