# Design Document: Klaw Voice Function Calling

## Overview

This design fixes Klaw (the voice assistant) to properly execute task management functions without speaking technical syntax. The solution replaces the current ACTION tag approach with Vapi's native server-side function calling via a Supabase Edge Function webhook.

### Current Problem
Klaw's system prompt includes ACTION tag syntax like `[ACTION:createTask:{"description":"..."}]`. The LLM generates these tags in its response, but Vapi's text-to-speech reads them aloud, resulting in Klaw saying things like "ACTION createTask confirmed true done" instead of natural responses.

### Solution
1. Create a `vapi-webhook` Edge Function that handles function calls from Vapi
2. Configure Vapi assistant with `serverUrl` pointing to the webhook
3. Define tools in the Vapi config so the LLM uses native function calling
4. Update Klaw's system prompt to remove ACTION tag instructions
5. The webhook executes functions and returns results to Vapi

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │ VapiService │───▶│ Vapi Web   │───▶│ AssistantPage    │    │
│  │ (client)    │    │ SDK        │    │ (UI updates)     │    │
│  └─────────────┘    └─────────────┘    └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                    │
         │ start(config)      │ events (transcript, state)
         ▼                    │
┌─────────────────────────────────────────────────────────────────┐
│                         Vapi Cloud                              │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │ Speech-to-  │───▶│ LLM (Groq) │───▶│ Text-to-Speech   │    │
│  │ Text        │    │ + Tools    │    │ (Elliot voice)   │    │
│  └─────────────┘    └─────────────┘    └──────────────────┘    │
│                           │                                     │
│                           │ tool_call                           │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │ serverUrl   │                              │
│                    │ webhook     │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ POST /vapi-webhook
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    vapi-webhook                          │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │   │
│  │  │ Verify    │─▶│ Extract   │─▶│ Execute Function  │   │   │
│  │  │ Request   │  │ userId    │  │ (taskService)     │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Supabase Client
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Database                          │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │ big_tasks   │    │ sub_tasks   │    │ profiles         │    │
│  └─────────────┘    └─────────────┘    └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. vapi-webhook Edge Function

New Supabase Edge Function at `supabase/functions/vapi-webhook/index.ts`.

```typescript
interface VapiWebhookRequest {
  message: {
    type: 'tool-calls' | 'assistant-request' | 'status-update' | 'end-of-call-report'
    toolCalls?: VapiToolCall[]
    call?: {
      id: string
      assistantId?: string
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
```

### 2. Updated VapiService Configuration

Modify `src/services/vapiService.ts` to use server-side function calling.

```typescript
interface VapiAssistantConfig {
  name: string
  firstMessage: string
  model: {
    provider: 'groq'
    model: string
    messages: { role: string; content: string }[]
    tools: VapiTool[]  // Add tool definitions
  }
  voice: {
    provider: string
    voiceId: string
  }
  serverUrl: string  // Add webhook URL
  serverUrlSecret: string  // Add secret for verification
}

interface VapiTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}
```

### 3. Updated System Prompt

Create `KLAW_VOICE_PROMPT` without ACTION tags in `src/services/assistantPrompt.ts`.

```typescript
export const KLAW_VOICE_PROMPT = `You are Klaw, an energetic and upbeat task assistant.

## Your Personality
- Warm, enthusiastic, encouraging
- Celebrates every win
- Brief, punchy responses
- NO emojis (this is voice)

## Your Capabilities
You can help users with:
- Creating new tasks
- Completing tasks and subtasks
- Starting, pausing, and stopping focus timers
- Setting reminders
- Listing tasks and suggesting what to do next

## How to Respond
- Keep responses SHORT - one sentence when possible
- Sound like a friend, not a robot
- Celebrate completions: "Boom!" "Crushed it!" "Nice work!"
- For errors: "Hmm, couldn't find that one" or "Let me know which task you mean"

## Current Tasks
{taskContext}
`
```

### 4. Function Definitions for Vapi

Tool definitions matching existing `ASSISTANT_FUNCTION_DEFINITIONS` but formatted for Vapi.

```typescript
export const VAPI_TOOL_DEFINITIONS: VapiTool[] = [
  {
    type: 'function',
    function: {
      name: 'createTask',
      description: 'Create a new task. Always confirm with user first.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Task name/description' },
          confirmed: { type: 'boolean', description: 'User confirmed creation' }
        },
        required: ['description', 'confirmed']
      }
    }
  },
  // ... other functions
]
```

## Data Models

### Vapi Call Metadata

Pass userId through Vapi's call metadata so the webhook knows which user's tasks to access.

```typescript
// When starting a call
await vapi.start({
  ...config,
  metadata: {
    userId: context.userId
  }
})
```

### Webhook Request/Response

The webhook receives Vapi's standard webhook format and returns tool results.

```typescript
// Request from Vapi
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [
      {
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "createTask",
          "arguments": { "description": "Buy groceries", "confirmed": true }
        }
      }
    ],
    "call": {
      "id": "call_xyz",
      "metadata": { "userId": "user_123" }
    }
  }
}

// Response to Vapi
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"success\":true,\"message\":\"Created task: Buy groceries\"}"
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Task mutation functions execute correctly through webhook

*For any* valid function call (createTask, completeTask, completeSubtask, deleteTask) with valid userId and parameters, the webhook SHALL execute the function and return a success result with the expected data structure.

**Validates: Requirements 1.2, 1.3, 4.1, 4.2**

### Property 2: Query functions return accurate task information

*For any* query function call (listTasks, getNextSubtask, getTaskDetails) with valid userId, the webhook SHALL return accurate information matching the user's current task state in the database.

**Validates: Requirements 4.5, 4.6**

### Property 3: Error handling returns structured responses

*For any* function call that fails (task not found, invalid parameters, database error), the webhook SHALL return a structured error response with success=false and a user-friendly message.

**Validates: Requirements 5.1, 5.3, 5.4, 6.4**

### Property 4: Authentication rejects invalid requests

*For any* webhook request without valid Vapi secret or missing userId, the webhook SHALL reject the request with an appropriate error status.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 5: System prompt contains no ACTION tag syntax

*For any* version of Klaw's voice system prompt, the prompt text SHALL NOT contain the pattern `[ACTION:` or instructions about ACTION tag formatting.

**Validates: Requirements 3.1**

## Error Handling

### Webhook Errors

| Error Type | Response | User Experience |
|------------|----------|-----------------|
| Invalid secret | 401 Unauthorized | Call fails to start |
| Missing userId | 400 Bad Request | Klaw says "Something went wrong" |
| Task not found | Success with error message | Klaw says "Couldn't find that task" |
| Multiple matches | Success with disambiguation | Klaw asks "Which one?" |
| Database error | 500 Internal Error | Klaw says "Having trouble, try again" |

### Client-Side Handling

Timer functions (startTimer, pauseTimer, etc.) cannot be executed server-side because they require the FocusTimerContext. Options:

1. **Return instructions**: Webhook returns `{ action: 'startTimer', duration: 25 }` and client executes
2. **Exclude from webhook**: Keep timer functions client-side only
3. **Hybrid approach**: Webhook handles task operations, client handles timer

Recommended: **Option 1** - Return instructions for timer operations that the client executes.

## Testing Strategy

### Unit Tests

- Test webhook request parsing
- Test function execution with mock Supabase client
- Test error response formatting
- Test system prompt content (no ACTION tags)

### Property-Based Tests

Using fast-check for property-based testing:

1. **Property 1**: Generate random valid function calls, verify webhook returns success
2. **Property 2**: Generate random task states, verify query results match
3. **Property 3**: Generate error conditions, verify structured error responses
4. **Property 4**: Generate invalid auth scenarios, verify rejection
5. **Property 5**: Check prompt string for forbidden patterns

### Integration Tests

- End-to-end test with real Vapi call (manual)
- Webhook deployment verification
- Function execution with real database
