# Implementation Plan

- [x] 1. Create vapi-webhook Edge Function






  - [x] 1.1 Create webhook handler structure

    - Create `supabase/functions/vapi-webhook/index.ts`
    - Set up CORS headers and request handling
    - Parse Vapi webhook request format (tool-calls message type)
    - _Requirements: 2.3, 2.4_
  - [x] 1.2 Implement request verification

    - Verify request comes from Vapi using serverUrlSecret header
    - Extract userId from call.metadata
    - Return 401 for invalid requests
    - _Requirements: 6.1, 6.2_
  - [x] 1.3 Implement function dispatcher

    - Map function names to handlers (createTask, completeTask, etc.)
    - Execute functions using Supabase client with userId
    - Return results in Vapi's expected format
    - _Requirements: 2.4, 6.3_
  - [x] 1.4 Write property test for webhook authentication


    - **Property 4: Authentication rejects invalid requests**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 2. Implement task functions in webhook





  - [x] 2.1 Implement createTask handler


    - Query ai-proxy for task breakdown (emoji, subtasks)
    - Insert big_task and sub_tasks into database
    - Return success with task details
    - _Requirements: 4.1_
  - [x] 2.2 Implement completeTask and completeSubtask handlers


    - Find task/subtask by name (fuzzy match)
    - Update completed status
    - Award coins if completing task (match existing flow)
    - _Requirements: 4.2_
  - [x] 2.3 Implement query handlers (listTasks, getNextSubtask, getTaskDetails)


    - Query user's tasks from database
    - Format results for voice-friendly responses
    - _Requirements: 4.5, 4.6_
  - [x] 2.4 Implement setReminder handler


    - Parse time string to timestamp
    - Update task's reminder_at field
    - _Requirements: 4.4_
  - [x] 2.5 Implement deleteTask handler


    - Find task by name
    - Delete task and subtasks
    - _Requirements: 4.1_
  - [x] 2.6 Write property test for task mutation functions


    - **Property 1: Task mutation functions execute correctly through webhook**
    - **Validates: Requirements 1.2, 1.3, 4.1, 4.2**
  - [x] 2.7 Write property test for query functions

    - **Property 2: Query functions return accurate task information**
    - **Validates: Requirements 4.5, 4.6**

- [x] 3. Implement error handling in webhook



  - [x] 3.1 Add task-not-found handling


    - Return structured error when task name doesn't match
    - Include helpful message for Klaw to speak
    - _Requirements: 5.3_

  - [x] 3.2 Add disambiguation handling
    - Detect when multiple tasks match a name
    - Return list of matches for Klaw to ask about
    - _Requirements: 5.4_

  - [x] 3.3 Add general error handling
    - Catch database errors
    - Return user-friendly error messages

    - _Requirements: 5.1, 6.4_
  - [x] 3.4 Write property test for error handling


    - **Property 3: Error handling returns structured responses**
    - **Validates: Requirements 5.1, 5.3, 5.4, 6.4**

- [x] 4. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Klaw's system prompt





  - [x] 5.1 Create clean voice prompt without ACTION tags


    - Create KLAW_VOICE_PROMPT in assistantPrompt.ts
    - Remove all ACTION tag syntax and examples
    - Keep personality and conversation style guidance
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Add task context injection

    - Format current tasks for voice-friendly reading
    - Include in system prompt dynamically
    - _Requirements: 3.2_

  - [x] 5.3 Write property test for system prompt

    - **Property 5: System prompt contains no ACTION tag syntax**
    - **Validates: Requirements 3.1**

- [x] 6. Update VapiService configuration





  - [x] 6.1 Add tool definitions to Vapi config


    - Convert ASSISTANT_FUNCTION_DEFINITIONS to Vapi format
    - Include all task management functions


    - _Requirements: 2.2_
  - [x] 6.2 Add serverUrl to Vapi config


    - Point to deployed vapi-webhook Edge Function
    - Add VITE_VAPI_WEBHOOK_SECRET env variable


    - _Requirements: 2.1_
  - [x] 6.3 Pass userId in call metadata
    - Include userId when starting Vapi session
    - Ensure webhook can extract it
    - _Requirements: 6.2_
  - [x] 6.4 Handle timer function responses
    - Detect timer instructions in webhook response
    - Execute timer operations client-side via timerController
    - _Requirements: 4.3_

- [-] 7. Deploy and test




  - [x] 7.1 Deploy vapi-webhook Edge Function
    - Run `supabase functions deploy vapi-webhook`
    - No webhook secret needed - security is via userId validation in call metadata
    - _Requirements: 2.1_
  - [x] 7.2 Update environment variables


    - VITE_VAPI_WEBHOOK_URL is already configured in .env
    - No VAPI_WEBHOOK_SECRET needed (removed in favor of userId validation)
    - _Requirements: Setup_
  - [x] 7.3 Manual integration test






    - Start a voice call with Klaw
    - Test creating a task
    - Test completing a task
    - Test listing tasks
    - Verify no ACTION tags are spoken
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 8. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
