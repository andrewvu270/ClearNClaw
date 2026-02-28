import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for preflight requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-vapi-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================================
// Types
// ============================================================================

interface VapiWebhookRequest {
  message: {
    type: 'tool-calls' | 'assistant-request' | 'status-update' | 'end-of-call-report'
    toolCalls?: VapiToolCall[]
    call?: {
      id: string
      assistantId?: string
      metadata?: Record<string, unknown>
    }
    // For transient assistants, metadata may be on the assistant object
    assistant?: {
      metadata?: Record<string, unknown>
    }
  }
}

interface VapiToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

interface VapiWebhookResponse {
  results: VapiToolResult[]
}

interface VapiToolResult {
  toolCallId: string
  result: string // JSON stringified result
}

interface FunctionResult {
  success: boolean
  data?: unknown
  error?: 'task_not_found' | 'subtask_not_found' | 'disambiguation_needed' | 'invalid_input' | 'database_error' | 'unknown_error'
  message: string
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Creates a task-not-found error response with helpful message for Klaw to speak
 */
function taskNotFoundError(taskName: string): FunctionResult {
  return {
    success: false,
    error: 'task_not_found',
    message: `Couldn't find a task matching "${taskName}". Try saying the full task name or ask me to list your tasks.`,
  }
}

/**
 * Creates a subtask-not-found error response
 */
function subtaskNotFoundError(subtaskName: string): FunctionResult {
  return {
    success: false,
    error: 'subtask_not_found',
    message: `Couldn't find a subtask matching "${subtaskName}". Try saying the full subtask name.`,
  }
}

/**
 * Creates a disambiguation error response when multiple tasks match
 */
function disambiguationError(matches: { id: string; name: string }[], itemType: 'task' | 'subtask' = 'task'): FunctionResult {
  const names = matches.map(m => m.name).join(', ')
  return {
    success: false,
    error: 'disambiguation_needed',
    data: { matches },
    message: `Found multiple ${itemType}s: ${names}. Which one did you mean?`,
  }
}

/**
 * Creates a database error response with user-friendly message
 */
function databaseError(operation: string): FunctionResult {
  return {
    success: false,
    error: 'database_error',
    message: `Had trouble ${operation}. Want to try again?`,
  }
}

/**
 * Creates an invalid input error response
 */
function invalidInputError(message: string): FunctionResult {
  return {
    success: false,
    error: 'invalid_input',
    message,
  }
}

interface BigTask {
  id: string
  user_id: string
  name: string
  emoji: string
  completed: boolean
  created_at: string
  completed_at: string | null
  energy_tag: string | null
  reminder_at: string | null
}

interface SubTask {
  id: string
  big_task_id: string
  name: string
  emoji: string
  completed: boolean
  sort_order: number
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse request body
    // Note: We rely on userId validation instead of webhook secret
    // since we use transient assistants (created per-call via API)
    const body: VapiWebhookRequest = await req.json()
    console.log('Received webhook:', body.message.type)

    // 2. Only handle tool-calls message type
    if (body.message.type !== 'tool-calls') {
      return new Response(JSON.stringify({ message: 'Ignored non-tool-calls message' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Extract userId from call or assistant metadata (this is our security layer)
    // For transient assistants, metadata may be on the assistant object instead of call
    const userId = (body.message.call?.metadata?.userId ?? body.message.assistant?.metadata?.userId) as string | undefined
    if (!userId) {
      console.error('Missing userId in call metadata. Call metadata:', JSON.stringify(body.message.call?.metadata), 'Assistant metadata:', JSON.stringify(body.message.assistant?.metadata))
      return new Response(JSON.stringify({ error: 'Missing userId in call metadata' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 5. Process each tool call (with deduplication for createTask)
    const toolCalls = body.message.toolCalls ?? []
    const results: VapiToolResult[] = []

    // Track createTask calls to prevent duplicates in same request
    // Store normalized descriptions to catch progressive duplicates
    const createdTaskDescriptions: string[] = []

    for (const toolCall of toolCalls) {
      console.log(`Executing function: ${toolCall.function.name}`)

      // Deduplicate createTask calls using fuzzy matching
      if (toolCall.function.name === 'createTask') {
        const description = (toolCall.function.arguments.description as string)?.trim()
        if (description) {
          // Check if this is a duplicate using fuzzy matching
          const isDuplicate = createdTaskDescriptions.some((existing) => 
            isSimilarTask(existing, description)
          )

          if (isDuplicate) {
            console.log(`Skipping duplicate createTask in batch: ${description}`)
            results.push({
              toolCallId: toolCall.id,
              result: JSON.stringify({
                success: true,
                message: 'Already got that one!',
                data: { deduplicated: true },
              }),
            })
            continue
          }
          createdTaskDescriptions.push(description)
        }
      }

      const result = await executeFunction(
        supabase,
        userId,
        toolCall.function.name,
        toolCall.function.arguments
      )

      results.push({
        toolCallId: toolCall.id,
        result: JSON.stringify(result),
      })
    }

    // 6. Return results in Vapi's expected format
    const response: VapiWebhookResponse = { results }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// ============================================================================
// Function Dispatcher
// ============================================================================

async function executeFunction(
  supabase: SupabaseClient,
  userId: string,
  functionName: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  try {
    switch (functionName) {
      case 'createTask':
        return await handleCreateTask(supabase, userId, args)
      case 'completeTask':
        return await handleCompleteTask(supabase, userId, args)
      case 'completeSubtask':
        return await handleCompleteSubtask(supabase, userId, args)
      case 'deleteTask':
        return await handleDeleteTask(supabase, userId, args)
      case 'listTasks':
        return await handleListTasks(supabase, userId)
      case 'getNextSubtask':
        return await handleGetNextSubtask(supabase, userId)
      case 'getTaskDetails':
        return await handleGetTaskDetails(supabase, userId, args)
      case 'setReminder':
        return await handleSetReminder(supabase, userId, args)
      case 'removeReminder':
        return await handleRemoveReminder(supabase, userId, args)
      case 'setRecurrence':
        return await handleSetRecurrence(supabase, userId, args)
      case 'renameTask':
        return await handleRenameTask(supabase, userId, args)
      case 'clearCompletedTasks':
        return await handleClearCompletedTasks(supabase, userId, args)
      case 'renameSubtask':
        return await handleRenameSubtask(supabase, userId, args)
      case 'addSubtask':
        return await handleAddSubtask(supabase, userId, args)
      case 'removeSubtask':
        return await handleRemoveSubtask(supabase, userId, args)
      case 'startTimer':
        return handleStartTimer(args)
      case 'pauseTimer':
        return handlePauseTimer()
      case 'resumeTimer':
        return handleResumeTimer()
      case 'stopTimer':
        return handleStopTimer()
      case 'getTimerStatus':
        return handleGetTimerStatus()
      default:
        return invalidInputError(`I don't know how to do "${functionName}". Try asking me to create, complete, or list tasks.`)
    }
  } catch (error) {
    console.error(`Error executing ${functionName}:`, error)
    // Check if it's a database-related error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('database') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return databaseError(`with ${functionName}`)
    }
    return {
      success: false,
      error: 'unknown_error',
      message: 'Something went wrong. Want to try again?',
    }
  }
}

// ============================================================================
// Fuzzy Matching Utilities
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy duplicate detection
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Check if two task names are similar enough to be considered duplicates
 * Uses multiple strategies: exact match, substring, and fuzzy matching
 */
function isSimilarTask(name1: string, name2: string): boolean {
  const a = name1.toLowerCase().trim()
  const b = name2.toLowerCase().trim()

  // Exact match
  if (a === b) return true

  // Substring match (progressive duplicates)
  if (a.includes(b) || b.includes(a)) return true

  // Fuzzy match using Levenshtein distance
  // Allow up to 20% difference or 3 characters, whichever is larger
  const maxLen = Math.max(a.length, b.length)
  const threshold = Math.max(3, Math.floor(maxLen * 0.2))
  const distance = levenshteinDistance(a, b)
  if (distance <= threshold) return true

  // Word overlap check - if 60%+ of words match, consider similar
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))
  if (wordsA.size > 0 && wordsB.size > 0) {
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length
    const minWords = Math.min(wordsA.size, wordsB.size)
    if (intersection / minWords >= 0.6) return true
  }

  return false
}

// ============================================================================
// Task Functions
// ============================================================================

/**
 * Check if a task description is garbage/incomplete input
 * Rejects partial speech fragments like "add a", "create", "task for", etc.
 */
function isGarbageInput(description: string): boolean {
  const trimmed = description.trim().toLowerCase()
  
  // Too short to be a real task
  if (trimmed.length < 3) return true
  
  // Common incomplete fragments from voice
  const garbagePatterns = [
    /^(add|create|make|new|task|a|the|an|um|uh|like|so|and|or)$/i,
    /^(add|create|make|new)\s+(a|an|the|task)?$/i,
    /^(task|tasks)\s*(for)?$/i,
    /^(i need|i want|i have|i should|i gotta|i got)\s*(to|a)?$/i,
    /^(remind|reminder|set|start)\s*(me|a|the)?$/i,
    /^(can you|could you|please|hey|ok|okay)\s*$/i,
    /^[^a-z]*$/i, // No letters at all
  ]
  
  for (const pattern of garbagePatterns) {
    if (pattern.test(trimmed)) return true
  }
  
  // Must have at least one word with 3+ characters
  const words = trimmed.split(/\s+/)
  const hasRealWord = words.some(w => w.length >= 3 && /[a-z]/i.test(w))
  if (!hasRealWord) return true
  
  return false
}

async function handleCreateTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const description = args.description as string | undefined
  const confirmed = args.confirmed as boolean | undefined

  if (!description) {
    return invalidInputError('What task would you like to create?')
  }

  // Reject garbage/incomplete input from partial speech
  if (isGarbageInput(description)) {
    console.log(`Rejecting garbage input: "${description}"`)
    return {
      success: false,
      message: "Sorry, didn't catch that. What's the task?",
    }
  }

  if (!confirmed) {
    return {
      success: false,
      message: `Should I create a task called "${description}"?`,
    }
  }

  try {
    // Check for similar task created in last 30 seconds (catches progressive duplicates from voice)
    // Extended from 10s to 30s to catch more voice transcription duplicates
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
    const { data: recentTasks } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .gte('created_at', thirtySecondsAgo)

    if (recentTasks && recentTasks.length > 0) {
      // Use fuzzy matching to catch near-duplicates
      const duplicate = recentTasks.find((t) => isSimilarTask(t.name, description))

      if (duplicate) {
        console.log(`Duplicate detected: "${description}" similar to recent "${duplicate.name}"`)
        return {
          success: true,
          data: { taskId: duplicate.id, name: duplicate.name, deduplicated: true },
          message: `Already got "${duplicate.name}" on your list!`,
        }
      }
    }

    // Call ai-proxy for task breakdown (emoji, subtasks, energyTag)
    const breakdown = await getTaskBreakdown(description)

    // Insert big_task
    const { data: taskRow, error: taskError } = await supabase
      .from('big_tasks')
      .insert({
        user_id: userId,
        name: description,
        emoji: breakdown.emoji,
        energy_tag: breakdown.energyTag,
      })
      .select()
      .single()

    if (taskError || !taskRow) {
      console.error('Failed to create task:', taskError)
      return databaseError('creating that task')
    }

    // Insert sub_tasks
    if (breakdown.subTasks.length > 0) {
      const subTaskInserts = breakdown.subTasks.map((st, i) => ({
        big_task_id: taskRow.id,
        name: st.name,
        emoji: st.emoji,
        sort_order: i,
      }))

      const { error: subError } = await supabase
        .from('sub_tasks')
        .insert(subTaskInserts)

      if (subError) {
        console.error('Failed to create subtasks:', subError)
        // Task was created, just subtasks failed - still report success
      }
    }

    return {
      success: true,
      data: {
        taskId: taskRow.id,
        name: description,
        emoji: breakdown.emoji,
        subtaskCount: breakdown.subTasks.length,
      },
      message: `Created "${description}" with ${breakdown.subTasks.length} subtasks.`,
    }
  } catch (error) {
    console.error('Error in createTask:', error)
    return databaseError('creating that task')
  }
}

/**
 * Calls the ai-proxy edge function to get task breakdown
 */
async function getTaskBreakdown(description: string): Promise<{
  emoji: string
  subTasks: { name: string; emoji: string }[]
  energyTag: string
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    // Fallback if ai-proxy not available
    return {
      emoji: '📝',
      subTasks: [{ name: 'Get started', emoji: '▪️' }],
      energyTag: 'medium',
    }
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'breakdown',
        description,
      }),
    })

    if (!response.ok) {
      console.error('ai-proxy error:', response.status)
      throw new Error('ai-proxy failed')
    }

    const data = await response.json()
    return {
      emoji: data.emoji || '📝',
      subTasks: data.subTasks || [{ name: 'Get started', emoji: '▪️' }],
      energyTag: data.energyTag || 'medium',
    }
  } catch (error) {
    console.error('Failed to get task breakdown:', error)
    // Fallback
    return {
      emoji: '📝',
      subTasks: [{ name: 'Get started', emoji: '▪️' }],
      energyTag: 'medium',
    }
  }
}

async function handleCompleteTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined

  if (!taskName) {
    return invalidInputError('Which task do you want to complete?')
  }

  try {
    // Find task by name (fuzzy match using ilike)
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name, emoji')
      .eq('user_id', userId)
      .eq('completed', false)
      .ilike('name', `%${taskName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Mark all subtasks as completed first
    await supabase
      .from('sub_tasks')
      .update({ completed: true })
      .eq('big_task_id', task.id)

    // Mark the big task as completed and award coins
    const { error: completeError } = await supabase.rpc('complete_task_and_award', {
      p_task_id: task.id,
      p_user_id: userId,
    })

    // If RPC doesn't exist, fall back to direct update
    if (completeError) {
      console.log('RPC not available, using direct update:', completeError.message)
      const { error: updateError } = await supabase
        .from('big_tasks')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', task.id)

      if (updateError) {
        console.error('Error completing task:', updateError)
        return databaseError('completing that task')
      }
    }

    return {
      success: true,
      data: { taskId: task.id, name: task.name },
      message: `Boom! "${task.name}" is done!`,
    }
  } catch (error) {
    console.error('Error in completeTask:', error)
    return databaseError('completing that task')
  }
}

async function handleCompleteSubtask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const subtaskName = args.subtaskName as string | undefined
  const taskName = args.taskName as string | undefined

  if (!subtaskName) {
    return invalidInputError('Which subtask do you want to complete?')
  }

  try {
    // Build query to find subtask
    let query = supabase
      .from('sub_tasks')
      .select('id, name, big_task_id, big_tasks!inner(id, name, user_id)')
      .eq('completed', false)
      .eq('big_tasks.user_id', userId)
      .ilike('name', `%${subtaskName}%`)

    // If taskName provided, filter by parent task
    if (taskName) {
      query = query.ilike('big_tasks.name', `%${taskName}%`)
    }

    const { data: subtasks, error: findError } = await query

    if (findError) {
      console.error('Error finding subtask:', findError)
      return databaseError('finding that subtask')
    }

    if (!subtasks || subtasks.length === 0) {
      return subtaskNotFoundError(subtaskName)
    }

    if (subtasks.length > 1) {
      return disambiguationError(
        subtasks.map(s => ({ id: s.id, name: s.name })),
        'subtask'
      )
    }

    const subtask = subtasks[0]

    // Use RPC for atomic completion + coin award check
    const { error: completeError } = await supabase.rpc('complete_subtask_and_check', {
      p_subtask_id: subtask.id,
      p_user_id: userId,
    })

    // Fallback to direct update if RPC not available
    if (completeError) {
      console.log('RPC not available, using direct update:', completeError.message)
      const { error: updateError } = await supabase
        .from('sub_tasks')
        .update({ completed: true })
        .eq('id', subtask.id)

      if (updateError) {
        console.error('Error completing subtask:', updateError)
        return databaseError('completing that subtask')
      }
    }

    return {
      success: true,
      data: { subtaskId: subtask.id, name: subtask.name },
      message: `Nice! "${subtask.name}" is done!`,
    }
  } catch (error) {
    console.error('Error in completeSubtask:', error)
    return databaseError('completing that subtask')
  }
}

async function handleDeleteTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined
  const confirmed = args.confirmed as boolean | undefined

  if (!taskName) {
    return invalidInputError('Which task do you want to delete?')
  }

  try {
    // Find task by name
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', `%${taskName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Require confirmation before deleting
    if (!confirmed) {
      return {
        success: false,
        data: { taskId: task.id, name: task.name },
        message: `Are you sure you want to delete "${task.name}"?`,
      }
    }

    // Delete task (subtasks cascade via FK constraint)
    const { error: deleteError } = await supabase
      .from('big_tasks')
      .delete()
      .eq('id', task.id)

    if (deleteError) {
      console.error('Error deleting task:', deleteError)
      return databaseError('deleting that task')
    }

    return {
      success: true,
      data: { taskId: task.id, name: task.name },
      message: `Deleted "${task.name}".`,
    }
  } catch (error) {
    console.error('Error in deleteTask:', error)
    return databaseError('deleting that task')
  }
}

async function handleListTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<FunctionResult> {
  try {
    const { data: tasks, error } = await supabase
      .from('big_tasks')
      .select('id, name, emoji, completed, sub_tasks(id, name, completed)')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error listing tasks:', error)
      return databaseError('getting your tasks')
    }

    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        data: { tasks: [] },
        message: "You don't have any active tasks. Want to create one?",
      }
    }

    // Format for voice-friendly response
    const taskSummaries = tasks.map(t => {
      const subTasks = (t.sub_tasks as { id: string; name: string; completed: boolean }[]) || []
      const completedCount = subTasks.filter(s => s.completed).length
      const totalCount = subTasks.length
      return {
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        progress: `${completedCount}/${totalCount}`,
      }
    })

    const taskList = taskSummaries.map(t => t.name).join(', ')
    
    return {
      success: true,
      data: { tasks: taskSummaries },
      message: `You have ${tasks.length} active task${tasks.length === 1 ? '' : 's'}: ${taskList}.`,
    }
  } catch (error) {
    console.error('Error in listTasks:', error)
    return databaseError('getting your tasks')
  }
}

async function handleGetNextSubtask(
  supabase: SupabaseClient,
  userId: string
): Promise<FunctionResult> {
  try {
    // Get the first incomplete subtask from the most recent incomplete task
    const { data: tasks, error } = await supabase
      .from('big_tasks')
      .select('id, name, emoji, sub_tasks(id, name, emoji, completed, sort_order)')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error getting next subtask:', error)
      return databaseError('finding your next step')
    }

    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        data: { nextSubtask: null },
        message: "You don't have any active tasks. Want to create one?",
      }
    }

    // Find first incomplete subtask across all tasks
    for (const task of tasks) {
      const subTasks = ((task.sub_tasks as { id: string; name: string; emoji: string; completed: boolean; sort_order: number }[]) || [])
        .sort((a, b) => a.sort_order - b.sort_order)
      
      const nextSubtask = subTasks.find(s => !s.completed)
      if (nextSubtask) {
        return {
          success: true,
          data: {
            nextSubtask: {
              id: nextSubtask.id,
              name: nextSubtask.name,
              taskName: task.name,
            },
          },
          message: `Next up: "${nextSubtask.name}" from "${task.name}".`,
        }
      }
    }

    // All subtasks completed but tasks not marked complete
    return {
      success: true,
      data: { nextSubtask: null },
      message: `Looks like you've finished all your subtasks! Want to mark a task complete?`,
    }
  } catch (error) {
    console.error('Error in getNextSubtask:', error)
    return databaseError('finding your next step')
  }
}

async function handleGetTaskDetails(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined

  if (!taskName) {
    return invalidInputError('Which task do you want details about?')
  }

  try {
    const { data: tasks, error } = await supabase
      .from('big_tasks')
      .select('id, name, emoji, completed, energy_tag, sub_tasks(id, name, emoji, completed, sort_order)')
      .eq('user_id', userId)
      .ilike('name', `%${taskName}%`)
      .limit(5)

    if (error) {
      console.error('Error getting task details:', error)
      return databaseError('getting task details')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]
    const subTasks = ((task.sub_tasks as { id: string; name: string; emoji: string; completed: boolean; sort_order: number }[]) || [])
      .sort((a, b) => a.sort_order - b.sort_order)
    
    const completedCount = subTasks.filter(s => s.completed).length
    const totalCount = subTasks.length
    const incompleteSubtasks = subTasks.filter(s => !s.completed).map(s => s.name)

    let message = `"${task.name}" has ${completedCount} of ${totalCount} subtasks done.`
    if (incompleteSubtasks.length > 0 && incompleteSubtasks.length <= 3) {
      message += ` Remaining: ${incompleteSubtasks.join(', ')}.`
    } else if (incompleteSubtasks.length > 3) {
      message += ` ${incompleteSubtasks.length} subtasks left.`
    }

    return {
      success: true,
      data: {
        task: {
          id: task.id,
          name: task.name,
          emoji: task.emoji,
          completed: task.completed,
          energyTag: task.energy_tag,
          subtasks: subTasks.map(s => ({
            id: s.id,
            name: s.name,
            completed: s.completed,
          })),
        },
      },
      message,
    }
  } catch (error) {
    console.error('Error in getTaskDetails:', error)
    return databaseError('getting task details')
  }
}

async function handleSetReminder(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined
  const time = args.time as string | undefined

  if (!taskName) {
    return invalidInputError('Which task do you want to set a reminder for?')
  }

  if (!time) {
    return invalidInputError('When should I remind you?')
  }

  try {
    // Find task by name
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .eq('completed', false)
      .ilike('name', `%${taskName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Parse time string to timestamp
    const reminderAt = parseTimeToTimestamp(time)
    if (!reminderAt) {
      return invalidInputError(`I didn't understand "${time}". Try something like "in 30 minutes" or "at 3pm".`)
    }

    // Update task's reminder_at field
    const { error: updateError } = await supabase
      .from('big_tasks')
      .update({ reminder_at: reminderAt })
      .eq('id', task.id)

    if (updateError) {
      console.error('Error setting reminder:', updateError)
      return databaseError('setting that reminder')
    }

    // Format time for voice response
    const reminderDate = new Date(reminderAt)
    const timeStr = reminderDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })

    return {
      success: true,
      data: { taskId: task.id, reminderAt },
      message: `Got it! I'll remind you about "${task.name}" at ${timeStr}.`,
    }
  } catch (error) {
    console.error('Error in setReminder:', error)
    return databaseError('setting that reminder')
  }
}

/**
 * Parse natural language time string to ISO timestamp
 */
function parseTimeToTimestamp(timeStr: string): string | null {
  const now = new Date()
  const lowerTime = timeStr.toLowerCase().trim()

  // Handle "in X minutes/hours"
  const inMatch = lowerTime.match(/in\s+(\d+)\s*(minute|min|hour|hr)s?/i)
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10)
    const unit = inMatch[2].toLowerCase()
    const ms = unit.startsWith('hour') || unit.startsWith('hr') 
      ? amount * 60 * 60 * 1000 
      : amount * 60 * 1000
    return new Date(now.getTime() + ms).toISOString()
  }

  // Handle "at X:XX" or "at Xpm/am"
  const atMatch = lowerTime.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (atMatch) {
    let hours = parseInt(atMatch[1], 10)
    const minutes = atMatch[2] ? parseInt(atMatch[2], 10) : 0
    const meridiem = atMatch[3]?.toLowerCase()

    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0

    // If no meridiem and hour is less than current, assume PM
    if (!meridiem && hours < 12 && hours <= now.getHours()) {
      hours += 12
    }

    const target = new Date(now)
    target.setHours(hours, minutes, 0, 0)

    // If time is in the past, move to tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1)
    }

    return target.toISOString()
  }

  // Handle simple times like "3pm", "3:30pm"
  const simpleMatch = lowerTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (simpleMatch) {
    let hours = parseInt(simpleMatch[1], 10)
    const minutes = simpleMatch[2] ? parseInt(simpleMatch[2], 10) : 0
    const meridiem = simpleMatch[3].toLowerCase()

    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0

    const target = new Date(now)
    target.setHours(hours, minutes, 0, 0)

    if (target <= now) {
      target.setDate(target.getDate() + 1)
    }

    return target.toISOString()
  }

  // Handle "tomorrow"
  if (lowerTime.includes('tomorrow')) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0) // Default to 9am
    return tomorrow.toISOString()
  }

  return null
}

// ============================================================================
// Timer Functions (Return instructions for client-side execution)
// ============================================================================

function handleStartTimer(args: Record<string, unknown>): FunctionResult {
  const duration = (args.duration as number) ?? 25
  const taskName = args.taskName as string | undefined

  return {
    success: true,
    data: {
      action: 'startTimer',
      duration,
      taskName,
    },
    message: `Starting a ${duration} minute timer${taskName ? ` for ${taskName}` : ''}.`,
  }
}

function handlePauseTimer(): FunctionResult {
  return {
    success: true,
    data: { action: 'pauseTimer' },
    message: 'Timer paused.',
  }
}

function handleResumeTimer(): FunctionResult {
  return {
    success: true,
    data: { action: 'resumeTimer' },
    message: 'Timer resumed.',
  }
}

function handleStopTimer(): FunctionResult {
  return {
    success: true,
    data: { action: 'stopTimer' },
    message: 'Timer stopped.',
  }
}

// ============================================================================
// Subtask Modification Functions
// ============================================================================

async function handleRenameSubtask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const oldName = args.oldName as string | undefined
  const newName = args.newName as string | undefined

  if (!oldName) {
    return invalidInputError('Which subtask do you want to rename?')
  }

  if (!newName) {
    return invalidInputError('What should I rename it to?')
  }

  try {
    // Find subtask by name (fuzzy match)
    const { data: subtasks, error: findError } = await supabase
      .from('sub_tasks')
      .select('id, name, big_task_id, big_tasks!inner(id, name, user_id)')
      .eq('big_tasks.user_id', userId)
      .ilike('name', `%${oldName}%`)

    if (findError) {
      console.error('Error finding subtask:', findError)
      return databaseError('finding that subtask')
    }

    if (!subtasks || subtasks.length === 0) {
      return subtaskNotFoundError(oldName)
    }

    if (subtasks.length > 1) {
      return disambiguationError(
        subtasks.map((s) => ({ id: s.id, name: s.name })),
        'subtask'
      )
    }

    const subtask = subtasks[0]

    // Update the subtask name
    const { error: updateError } = await supabase
      .from('sub_tasks')
      .update({ name: newName })
      .eq('id', subtask.id)

    if (updateError) {
      console.error('Error renaming subtask:', updateError)
      return databaseError('renaming that subtask')
    }

    return {
      success: true,
      data: { subtaskId: subtask.id, oldName: subtask.name, newName },
      message: `Updated "${subtask.name}" to "${newName}".`,
    }
  } catch (error) {
    console.error('Error in renameSubtask:', error)
    return databaseError('renaming that subtask')
  }
}

async function handleAddSubtask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined
  const subtaskDescription = args.subtaskDescription as string | undefined

  if (!taskName) {
    return invalidInputError('Which task should I add the subtask to?')
  }

  if (!subtaskDescription) {
    return invalidInputError('What should the subtask be?')
  }

  try {
    // Find the parent task
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .eq('completed', false)
      .ilike('name', `%${taskName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map((t) => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Get current max sort_order for this task
    const { data: existingSubtasks } = await supabase
      .from('sub_tasks')
      .select('sort_order')
      .eq('big_task_id', task.id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextSortOrder = existingSubtasks && existingSubtasks.length > 0 ? existingSubtasks[0].sort_order + 1 : 0

    // Insert the new subtask
    const { data: newSubtask, error: insertError } = await supabase
      .from('sub_tasks')
      .insert({
        big_task_id: task.id,
        name: subtaskDescription,
        emoji: '▪️',
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (insertError || !newSubtask) {
      console.error('Error adding subtask:', insertError)
      return databaseError('adding that subtask')
    }

    return {
      success: true,
      data: { subtaskId: newSubtask.id, taskId: task.id, name: subtaskDescription },
      message: `Added "${subtaskDescription}" to "${task.name}".`,
    }
  } catch (error) {
    console.error('Error in addSubtask:', error)
    return databaseError('adding that subtask')
  }
}

async function handleRemoveSubtask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const subtaskName = args.subtaskName as string | undefined

  if (!subtaskName) {
    return invalidInputError('Which subtask do you want to remove?')
  }

  try {
    // Find subtask by name
    const { data: subtasks, error: findError } = await supabase
      .from('sub_tasks')
      .select('id, name, big_task_id, big_tasks!inner(id, name, user_id)')
      .eq('big_tasks.user_id', userId)
      .ilike('name', `%${subtaskName}%`)

    if (findError) {
      console.error('Error finding subtask:', findError)
      return databaseError('finding that subtask')
    }

    if (!subtasks || subtasks.length === 0) {
      return subtaskNotFoundError(subtaskName)
    }

    if (subtasks.length > 1) {
      return disambiguationError(
        subtasks.map((s) => ({ id: s.id, name: s.name })),
        'subtask'
      )
    }

    const subtask = subtasks[0]

    // Delete the subtask
    const { error: deleteError } = await supabase.from('sub_tasks').delete().eq('id', subtask.id)

    if (deleteError) {
      console.error('Error removing subtask:', deleteError)
      return databaseError('removing that subtask')
    }

    return {
      success: true,
      data: { subtaskId: subtask.id, name: subtask.name },
      message: `Removed "${subtask.name}".`,
    }
  } catch (error) {
    console.error('Error in removeSubtask:', error)
    return databaseError('removing that subtask')
  }
}


// ============================================================================
// Additional Functions
// ============================================================================

async function handleRemoveReminder(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined

  if (!taskName) {
    return invalidInputError('Which task should I remove the reminder from?')
  }

  try {
    // Find task by name
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', `%${taskName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Clear the reminder
    const { error: updateError } = await supabase
      .from('big_tasks')
      .update({ reminder_at: null })
      .eq('id', task.id)

    if (updateError) {
      console.error('Error removing reminder:', updateError)
      return databaseError('removing that reminder')
    }

    return {
      success: true,
      data: { taskId: task.id, name: task.name },
      message: `Removed reminder from "${task.name}".`,
    }
  } catch (error) {
    console.error('Error in removeReminder:', error)
    return databaseError('removing that reminder')
  }
}

async function handleSetRecurrence(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const taskName = args.taskName as string | undefined
  const frequency = args.frequency as string | undefined

  if (!taskName) {
    return invalidInputError('Which task should repeat?')
  }

  if (!frequency) {
    return invalidInputError('How often should it repeat? Daily, weekly, or monthly?')
  }

  // Parse frequency
  const recurrenceType = parseRecurrenceFrequency(frequency)
  if (!recurrenceType) {
    return invalidInputError(`I didn't understand "${frequency}". Try daily, weekdays, weekly, or monthly.`)
  }

  try {
    // Find task by name
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .eq('completed', false)
      .ilike('name', `%${taskName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(taskName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Update recurrence
    const { error: updateError } = await supabase
      .from('big_tasks')
      .update({ 
        recurrence_type: recurrenceType,
        recurrence_config: { type: recurrenceType }
      })
      .eq('id', task.id)

    if (updateError) {
      console.error('Error setting recurrence:', updateError)
      return databaseError('setting that recurrence')
    }

    return {
      success: true,
      data: { taskId: task.id, name: task.name, frequency: recurrenceType },
      message: `"${task.name}" will now repeat ${recurrenceType}.`,
    }
  } catch (error) {
    console.error('Error in setRecurrence:', error)
    return databaseError('setting that recurrence')
  }
}

/**
 * Parse recurrence frequency string
 */
function parseRecurrenceFrequency(frequency: string): string | null {
  const lower = frequency.toLowerCase().trim()

  if (lower === 'daily' || lower === 'every day') return 'daily'
  if (lower === 'weekdays' || lower === 'on weekdays') return 'weekdays'
  if (lower === 'weekends' || lower === 'on weekends') return 'weekends'
  if (lower === 'weekly' || lower === 'every week') return 'weekly'
  if (lower === 'monthly' || lower === 'every month') return 'monthly'
  if (lower === 'yearly' || lower === 'every year') return 'yearly'

  return null
}

async function handleRenameTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const oldName = args.oldName as string | undefined
  const newName = args.newName as string | undefined

  if (!oldName) {
    return invalidInputError('Which task do you want to rename?')
  }

  if (!newName) {
    return invalidInputError('What should I rename it to?')
  }

  try {
    // Find task by name
    const { data: tasks, error: findError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', `%${oldName}%`)

    if (findError) {
      console.error('Error finding task:', findError)
      return databaseError('finding that task')
    }

    if (!tasks || tasks.length === 0) {
      return taskNotFoundError(oldName)
    }

    if (tasks.length > 1) {
      return disambiguationError(tasks.map(t => ({ id: t.id, name: t.name })))
    }

    const task = tasks[0]

    // Update the task name
    const { error: updateError } = await supabase
      .from('big_tasks')
      .update({ name: newName })
      .eq('id', task.id)

    if (updateError) {
      console.error('Error renaming task:', updateError)
      return databaseError('renaming that task')
    }

    return {
      success: true,
      data: { taskId: task.id, oldName: task.name, newName },
      message: `Renamed "${task.name}" to "${newName}".`,
    }
  } catch (error) {
    console.error('Error in renameTask:', error)
    return databaseError('renaming that task')
  }
}

async function handleClearCompletedTasks(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const confirmed = args.confirmed as boolean | undefined

  try {
    // Count completed tasks first
    const { data: completedTasks, error: countError } = await supabase
      .from('big_tasks')
      .select('id, name')
      .eq('user_id', userId)
      .eq('completed', true)

    if (countError) {
      console.error('Error counting completed tasks:', countError)
      return databaseError('checking completed tasks')
    }

    const count = completedTasks?.length ?? 0

    if (count === 0) {
      return {
        success: true,
        data: { count: 0 },
        message: 'No completed tasks to clear.',
      }
    }

    if (!confirmed) {
      return {
        success: false,
        data: { count },
        message: `Delete ${count} completed task${count > 1 ? 's' : ''}? This can't be undone.`,
      }
    }

    // Delete all completed tasks
    const { error: deleteError } = await supabase
      .from('big_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('completed', true)

    if (deleteError) {
      console.error('Error clearing completed tasks:', deleteError)
      return databaseError('clearing completed tasks')
    }

    return {
      success: true,
      data: { count },
      message: `Cleared ${count} completed task${count > 1 ? 's' : ''}.`,
    }
  } catch (error) {
    console.error('Error in clearCompletedTasks:', error)
    return databaseError('clearing completed tasks')
  }
}

function handleGetTimerStatus(): FunctionResult {
  // Timer status needs to be checked client-side
  // Return instruction for client to check and respond
  return {
    success: true,
    data: { action: 'getTimerStatus' },
    message: 'Checking timer status...',
  }
}
