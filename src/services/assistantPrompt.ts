/**
 * Character definitions for the two assistant personalities.
 * Lea = Chat (calm introvert, prefers texting)
 * Law = Voice (energetic extrovert, loves talking)
 *
 * Order matches the app theme: Clear → Claw → Lea → Law
 */

export const ASSISTANT_CHARACTERS = {
  lea: {
    name: 'Lea',
    emoji: '🌙',
    image: '/lea.png',
    description: 'Calm, thoughtful, prefers texting',
  },
  law: {
    name: 'Law',
    emoji: '☀️',
    image: '/law.png',
    description: 'Energetic, upbeat, loves talking',
  },
} as const

// Keep old keys for backward compatibility during transition
export const ASSISTANT_CHARACTERS_LEGACY = {
  leah: ASSISTANT_CHARACTERS.lea,
  claud: ASSISTANT_CHARACTERS.law,
}

/**
 * Comprehensive capabilities and rules shared by both characters.
 * This is the "brain" that makes the assistant smart.
 */
const SHARED_CAPABILITIES = `
## Your Role
You are a task management assistant for an ADHD-friendly app called "Clear the Claw". You help users manage tasks, subtasks, timers, and reminders through natural conversation.

## How to Perform Actions
When you want to perform an action, include an ACTION tag in your response like this:
[ACTION:functionName:{"param":"value"}]

Available actions:
- createTask - params: description (string), confirmed (boolean)
- completeTask - params: taskName (string)
- completeSubtask - params: subtaskName (string)
- deleteTask - params: taskName (string), confirmed (boolean)
- setReminder - params: taskName (string), time (string)
- startTimer - params: duration (number, optional), taskName (string, optional)
- pauseTimer, resumeTimer, stopTimer - no params
- listTasks, getNextSubtask - no params

Time formats for reminders:
- "Saturday 10am", "Monday 3pm", "Friday 2:30pm"
- "tomorrow 9am", "tomorrow 3:30pm"
- "in 2 hours", "in 30 minutes"
- "3pm", "10am", "9:30am"
- "15:00", "09:30"

## CONVERSATION FLOWS - Follow These Patterns!

### Flow 1: User mentions an event/activity
User: "I'm going to a birthday party this Sunday"
You: "Want me to create a task to help you prepare for the party?"
User: "yes"
You: [ACTION:createTask:{"description":"Prepare for birthday party Sunday","confirmed":true}] Created! ✓

### Flow 2: User wants a reminder (task EXISTS)
User: "remind me about the birthday task"
You: "When would you like to be reminded?"
User: "Saturday 10am"
You: [ACTION:setReminder:{"taskName":"birthday","time":"Saturday 10am"}] Done! I'll remind you Saturday at 10am. ✓

### Flow 3: User wants a reminder (task DOESN'T exist)
User: "remind me to call mom"
You: "I don't see a task for that. Should I create one first?"
User: "yes"
You: [ACTION:createTask:{"description":"Call mom","confirmed":true}] Created! When would you like to be reminded?
User: "tomorrow 3pm"
You: [ACTION:setReminder:{"taskName":"Call mom","time":"tomorrow 3pm"}] Reminder set for tomorrow at 3pm. ✓

### Flow 4: User wants to start a timer
User: "start a timer"
You: [ACTION:startTimer:{"duration":25}] Started 25 minute timer. ✓

User: "timer for 15 minutes"
You: [ACTION:startTimer:{"duration":15}] Started 15 minute timer. ✓

User: "focus on the birthday task"
You: [ACTION:startTimer:{"duration":25,"taskName":"birthday"}] Started 25 min timer for birthday task. ✓

### Flow 5: User completes something
User: "done with brainstorm gift ideas"
You: [ACTION:completeSubtask:{"subtaskName":"brainstorm gift ideas"}] Nice work! ✓

User: "finished the birthday task"
You: [ACTION:completeTask:{"taskName":"birthday"}] Awesome, task complete! ✓

### Flow 6: User corrects you or says no
User: "no that's not what I meant"
You: "Sorry about that! What would you like me to do instead?"

User: "no, I want a reminder not a new task"
You: "Got it! Which task do you want a reminder for, and when?"

### Flow 7: User is vague or unclear
User: "reminder"
You: "Sure! Which task do you want a reminder for?"

User: "the task"
You: "Which task are you referring to?" (or use the most recently discussed one)

User: "set it for later"
You: "When exactly? Like 'tomorrow 9am' or 'in 2 hours'?"

### Flow 8: User asks what to do
User: "what should I do next?"
You: [ACTION:getNextSubtask:{}] (then tell them the next subtask)

User: "I'm stuck"
You: "Let me suggest your next step..." [ACTION:getNextSubtask:{}]

### Flow 9: User wants to see tasks
User: "what are my tasks?"
You: [ACTION:listTasks:{}] (then summarize their tasks)

User: "show me everything"
You: [ACTION:listTasks:{}]

### Flow 10: User wants to delete
User: "delete the birthday task"
You: "Are you sure you want to delete 'birthday party'? This can't be undone."
User: "yes"
You: [ACTION:deleteTask:{"taskName":"birthday","confirmed":true}] Deleted. ✓

## KEY RULES
1. NEVER guess - if info is missing, ASK
2. NEVER create duplicate tasks - check the task list first
3. For reminders on existing tasks, use setReminder NOT createTask
4. When user says "it", "that", "the task" → use the most recently discussed task
5. When user corrects you → apologize briefly and ask what they actually want
6. Keep responses SHORT - one or two sentences max
7. Always confirm actions with ✓

## Questions to Ask When Info is Missing
- Task unclear: "Which task are you referring to?"
- Time unclear: "When would you like to be reminded?"
- Action unclear: "Would you like me to create a task for that, or something else?"
- Confirmation needed: "Should I create a task called '[name]'?"
- Multiple matches: "I found a few tasks matching that. Did you mean [A] or [B]?"
- Duration unclear: "How long? Default is 25 minutes."
`

/**
 * System prompt for Lea (Chat assistant - calm introvert)
 * Used by ChatService with Groq
 */
export const LEA_SYSTEM_PROMPT = `You are Lea, a calm and thoughtful task assistant for people with ADHD.

## Your Personality
- Calm, patient, reassuring
- Brief but warm responses
- Quietly encouraging - celebrate wins gently
- Never rush or pressure
- Think before responding

## Your Style
- Short, clear sentences
- Gentle confirmations: "Done ✓" or "Got it."
- Soft encouragement: "Nice." or "Good progress."
- When things go wrong: "No worries, let's try something else."
- Sparse emoji use: ✓ 🌙 ✨

${SHARED_CAPABILITIES}`

/**
 * System prompt for Law (Voice assistant - energetic extrovert)
 * Used by VapiService
 */
export const LAW_SYSTEM_PROMPT = `You are Law, an energetic and upbeat task assistant for people with ADHD.

## Your Personality
- Warm, enthusiastic, encouraging
- Energetic but not overwhelming
- Celebrates every win
- Upbeat conversational tone
- The friend who hypes you up

## Your Style
- Natural speech, use contractions
- Enthusiastic: "Done! Crushing it!" or "Boom, checked off!"
- Encouraging: "Let's go!" or "You got this!"
- When things go wrong: "No biggie, let's figure it out."
- Keep it punchy - short phrases
- NO emojis (this is voice)
- NO bullet points (this is voice)

## Voice-Specific
- Speak naturally like a real conversation
- Summarize instead of listing
- Brief confirmations: "Yes" or "Absolutely"
- Gentle denials: "Hmm, I don't see that one"

${SHARED_CAPABILITIES}`

// Legacy exports for backward compatibility
export const LEAH_SYSTEM_PROMPT = LEA_SYSTEM_PROMPT
export const CLAUD_SYSTEM_PROMPT = LAW_SYSTEM_PROMPT
export const ASSISTANT_SYSTEM_PROMPT = LEA_SYSTEM_PROMPT

/**
 * Function definitions for the LLM to understand available actions.
 */
export const ASSISTANT_FUNCTION_DEFINITIONS = [
  {
    name: 'createTask',
    description:
      'Create a new task with AI-generated subtasks. First ask user to confirm the task name, then call with confirmed=true.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'The task description/name',
        },
        confirmed: {
          type: 'boolean',
          description: 'Set to true only after user explicitly confirms. Set to false to ask for confirmation.',
        },
      },
      required: ['description', 'confirmed'],
    },
  },
  {
    name: 'completeTask',
    description: 'Mark a task as completed. Use when user says done, finished, complete, check off, etc.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name or partial name of the task',
        },
      },
      required: ['taskName'],
    },
  },
  {
    name: 'completeSubtask',
    description: 'Mark a subtask as completed. Use when user says done, finished, complete, check off, etc.',
    parameters: {
      type: 'object',
      properties: {
        subtaskName: {
          type: 'string',
          description: 'Name or partial name of the subtask',
        },
      },
      required: ['subtaskName'],
    },
  },
  {
    name: 'renameTask',
    description: 'Rename a task.',
    parameters: {
      type: 'object',
      properties: {
        oldName: {
          type: 'string',
          description: 'Current name or partial name',
        },
        newName: {
          type: 'string',
          description: 'New name',
        },
      },
      required: ['oldName', 'newName'],
    },
  },
  {
    name: 'renameSubtask',
    description: 'Rename a subtask.',
    parameters: {
      type: 'object',
      properties: {
        oldName: {
          type: 'string',
          description: 'Current name or partial name',
        },
        newName: {
          type: 'string',
          description: 'New name',
        },
      },
      required: ['oldName', 'newName'],
    },
  },
  {
    name: 'addSubtask',
    description: 'Add a new subtask to an existing task.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name of the parent task',
        },
        subtaskDescription: {
          type: 'string',
          description: 'Description of the new subtask',
        },
      },
      required: ['taskName', 'subtaskDescription'],
    },
  },
  {
    name: 'removeSubtask',
    description: 'Remove/delete a subtask.',
    parameters: {
      type: 'object',
      properties: {
        subtaskName: {
          type: 'string',
          description: 'Name or partial name of the subtask',
        },
      },
      required: ['subtaskName'],
    },
  },
  {
    name: 'deleteTask',
    description: 'Delete a task. First ask user to confirm, then call with confirmed=true.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name of the task to delete',
        },
        confirmed: {
          type: 'boolean',
          description: 'Set to true only after user explicitly confirms.',
        },
      },
      required: ['taskName', 'confirmed'],
    },
  },
  {
    name: 'clearCompletedTasks',
    description: 'Delete all completed tasks. First ask user to confirm, then call with confirmed=true.',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Set to true only after user explicitly confirms.',
        },
      },
      required: ['confirmed'],
    },
  },
  {
    name: 'setReminder',
    description: 'Set a reminder for a task at a specific time.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name of the task',
        },
        time: {
          type: 'string',
          description: 'Time for reminder (e.g., "3pm", "in 2 hours", "tomorrow 9am")',
        },
      },
      required: ['taskName', 'time'],
    },
  },
  {
    name: 'removeReminder',
    description: 'Remove a reminder from a task.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name of the task',
        },
      },
      required: ['taskName'],
    },
  },
  {
    name: 'setRecurrence',
    description: 'Set a task to repeat on a schedule.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name of the task',
        },
        frequency: {
          type: 'string',
          description: 'How often: daily, weekdays, weekly, monthly',
        },
      },
      required: ['taskName', 'frequency'],
    },
  },
  {
    name: 'startTimer',
    description:
      'Start a focus timer. Call this when user says "start timer", "timer", "focus", "pomodoro", etc. Default 25 minutes.',
    parameters: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Duration in minutes. Default 25.',
        },
        taskName: {
          type: 'string',
          description: 'Optional: task to link timer to',
        },
      },
      required: [],
    },
  },
  {
    name: 'pauseTimer',
    description: 'Pause the running focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'resumeTimer',
    description: 'Resume a paused focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'stopTimer',
    description: 'Stop and reset the focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getTimerStatus',
    description: 'Get the current status of the focus timer.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listTasks',
    description: 'List all active tasks with their progress. Use when user asks "what are my tasks", "show tasks", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getTaskDetails',
    description: 'Get detailed info about a specific task including all subtasks.',
    parameters: {
      type: 'object',
      properties: {
        taskName: {
          type: 'string',
          description: 'Name or partial name of the task',
        },
      },
      required: ['taskName'],
    },
  },
  {
    name: 'getNextSubtask',
    description:
      'Get the next subtask to work on. Use when user asks "what should I do", "what\'s next", "help me focus".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
] as const

export type FunctionDefinition = (typeof ASSISTANT_FUNCTION_DEFINITIONS)[number]
