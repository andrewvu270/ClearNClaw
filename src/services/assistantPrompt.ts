/**
 * Shared system prompt for the AI assistant.
 * Used by both ChatService (Groq) and VapiService (Voice) to ensure consistent behavior.
 */

export const ASSISTANT_SYSTEM_PROMPT = `You are a friendly, helpful task management assistant designed for people with ADHD. Your role is to help users manage their tasks, subtasks, focus timers, and reminders through natural conversation.

## Personality
- Be warm, encouraging, and supportive
- Keep responses brief and conversational - no walls of text
- Celebrate small wins and progress
- Be patient and understanding when users need clarification
- Use a casual, friendly tone

## Capabilities
You can help users with:
- Creating new tasks (with AI-generated subtasks)
- Completing tasks and subtasks
- Renaming tasks and subtasks
- Adding or removing subtasks
- Deleting tasks
- Clearing completed tasks
- Setting reminders and recurring schedules
- Controlling focus timers (start, pause, resume, stop)
- Querying task status and suggesting what to work on next

## Important Rules

### Confirmation Required
You MUST ask for explicit confirmation before:
1. Creating a new task - Always confirm the task name before calling createTask with confirmed=true
2. Deleting a task - Always confirm before calling deleteTask with confirmed=true
3. Clearing completed tasks - Always confirm before calling clearCompletedTasks with confirmed=true

When a user mentions something that sounds like a task but doesn't explicitly say "create task" or "add task", offer to create it and wait for confirmation.

### Disambiguation
When multiple tasks or subtasks match a name the user provides, DO NOT guess. Instead:
- List the matching items
- Ask the user to specify which one they mean

### Natural Language Understanding
- Understand variations like "check off", "mark done", "finish", "complete" as completion actions
- Understand "remove", "delete", "get rid of" as deletion actions
- Understand time expressions like "in 2 hours", "at 3pm", "tomorrow morning"
- Understand frequency words like "daily", "every day", "weekly", "on weekdays"

### Response Style
- Confirm actions after they're done: "Done! Marked 'Buy groceries' as complete."
- Be concise - one or two sentences is usually enough
- If something fails, explain simply and suggest alternatives
- When listing tasks, use a brief format

## Context
You have access to the user's active tasks (up to 20 most recently updated). When the user says "it", "that task", or "the last one", refer to the most recently discussed task in the conversation.`

/**
 * Function definitions for the LLM to understand available actions.
 * These are used by both Groq (chat) and Vapi (voice) services.
 */
export const ASSISTANT_FUNCTION_DEFINITIONS = [
  {
    name: 'createTask',
    description: 'Create a new task with AI-generated subtasks. REQUIRES user confirmation first - only call with confirmed=true after user explicitly confirms.',
    parameters: {
      type: 'object',
      properties: {
        description: { 
          type: 'string', 
          description: 'The task description/name' 
        },
        confirmed: { 
          type: 'boolean', 
          description: 'Whether user has explicitly confirmed creation. Must be true to actually create.' 
        }
      },
      required: ['description', 'confirmed']
    }
  },
  {
    name: 'completeTask',
    description: 'Mark a BigTask as completed. All subtasks must be done first.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name or partial name of the task to complete' 
        }
      },
      required: ['taskName']
    }
  },
  {
    name: 'completeSubtask',
    description: 'Mark a subtask as completed.',
    parameters: {
      type: 'object',
      properties: {
        subtaskName: { 
          type: 'string', 
          description: 'Name or partial name of the subtask to complete' 
        }
      },
      required: ['subtaskName']
    }
  },
  {
    name: 'renameTask',
    description: 'Rename a BigTask.',
    parameters: {
      type: 'object',
      properties: {
        oldName: { 
          type: 'string', 
          description: 'Current name or partial name of the task' 
        },
        newName: { 
          type: 'string', 
          description: 'New name for the task' 
        }
      },
      required: ['oldName', 'newName']
    }
  },
  {
    name: 'renameSubtask',
    description: 'Rename a subtask.',
    parameters: {
      type: 'object',
      properties: {
        oldName: { 
          type: 'string', 
          description: 'Current name or partial name of the subtask' 
        },
        newName: { 
          type: 'string', 
          description: 'New name for the subtask' 
        }
      },
      required: ['oldName', 'newName']
    }
  },
  {
    name: 'addSubtask',
    description: 'Add a new subtask to an existing task.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name or partial name of the parent task' 
        },
        subtaskDescription: { 
          type: 'string', 
          description: 'Description of the new subtask' 
        }
      },
      required: ['taskName', 'subtaskDescription']
    }
  },
  {
    name: 'removeSubtask',
    description: 'Remove/delete a subtask.',
    parameters: {
      type: 'object',
      properties: {
        subtaskName: { 
          type: 'string', 
          description: 'Name or partial name of the subtask to remove' 
        }
      },
      required: ['subtaskName']
    }
  },
  {
    name: 'deleteTask',
    description: 'Delete a BigTask. REQUIRES user confirmation first - only call with confirmed=true after user explicitly confirms.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name of the task to delete' 
        },
        confirmed: { 
          type: 'boolean', 
          description: 'Whether user has explicitly confirmed deletion. Must be true to actually delete.' 
        }
      },
      required: ['taskName', 'confirmed']
    }
  },
  {
    name: 'clearCompletedTasks',
    description: 'Delete all completed tasks. REQUIRES user confirmation first - only call with confirmed=true after user explicitly confirms.',
    parameters: {
      type: 'object',
      properties: {
        confirmed: { 
          type: 'boolean', 
          description: 'Whether user has explicitly confirmed clearing. Must be true to actually clear.' 
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'setReminder',
    description: 'Set a reminder for a task at a specific time.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name or partial name of the task' 
        },
        time: { 
          type: 'string', 
          description: 'Time for the reminder (e.g., "3pm", "15:00", "in 2 hours")' 
        }
      },
      required: ['taskName', 'time']
    }
  },
  {
    name: 'removeReminder',
    description: 'Remove a reminder from a task.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name or partial name of the task' 
        }
      },
      required: ['taskName']
    }
  },
  {
    name: 'setRecurrence',
    description: 'Set a task to repeat on a schedule.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name or partial name of the task' 
        },
        frequency: { 
          type: 'string', 
          description: 'How often to repeat (daily, weekdays, weekly, monthly)' 
        }
      },
      required: ['taskName', 'frequency']
    }
  },
  {
    name: 'startTimer',
    description: 'Start a focus timer. Optionally specify duration and task.',
    parameters: {
      type: 'object',
      properties: {
        duration: { 
          type: 'number', 
          description: 'Duration in minutes (default: 25)' 
        },
        taskName: { 
          type: 'string', 
          description: 'Optional task name to associate with the timer' 
        }
      },
      required: []
    }
  },
  {
    name: 'pauseTimer',
    description: 'Pause the running focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'resumeTimer',
    description: 'Resume a paused focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'stopTimer',
    description: 'Stop and reset the focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getTimerStatus',
    description: 'Get the current status of the focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'listTasks',
    description: 'List all active (non-completed) tasks with their progress.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getTaskDetails',
    description: 'Get detailed information about a specific task including all subtasks.',
    parameters: {
      type: 'object',
      properties: {
        taskName: { 
          type: 'string', 
          description: 'Name or partial name of the task' 
        }
      },
      required: ['taskName']
    }
  },
  {
    name: 'getNextSubtask',
    description: 'Get the next subtask to work on. Prioritizes active timer task, then highest progress task.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
] as const

/**
 * Type for function definition
 */
export type FunctionDefinition = typeof ASSISTANT_FUNCTION_DEFINITIONS[number]
