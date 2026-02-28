# Implementation Plan

- [x] 1. Set up project structure and core interfaces






  - [x] 1.1 Create assistant types and interfaces

    - Create `src/types/assistant.ts` with ChatMessage, AssistantContext, FunctionCall, FunctionResult interfaces
    - Define AssistantFunction type union for all available functions
    - _Requirements: 2.2, 13.1_
  - [x] 1.2 Add environment variables


    - Add VITE_GROQ_API_KEY to .env
    - Add VITE_VAPI_API_KEY to .env
    - Update .env.example with placeholder values
    - _Requirements: Setup_
  - [x] 1.3 Add assistant route and navigation


    - Add AssistantPage route to App.tsx
    - Add Assistant nav item to BottomNavBar component
    - _Requirements: 1.1_
  - [x] 1.4 Write property test for assistant types


    - **Property 8: Function calls include required parameters**
    - **Validates: Requirements 2.2**

- [x] 2. Implement FunctionCaller service





  - [x] 2.1 Create FunctionCaller with task operations


    - Create `src/services/assistantFunctions.ts`
    - Implement createTask, completeTask, completeSubtask functions
    - Implement renameTask, renameSubtask, addSubtask, removeSubtask functions
    - Implement deleteTask, clearCompletedTasks functions
    - Wire to existing taskService methods (use same completion handler that triggers coin awarding)
    - NOTE: completeTask must go through existing completion flow to award coins, not direct DB write
    - _Requirements: 4.2, 5.1, 5.2, 6.1-6.4, 7.1, 7.2_
  - [x] 2.2 Add scheduling and timer functions


    - Implement setReminder, removeReminder, setRecurrence functions
    - Implement startTimer, pauseTimer, resumeTimer, stopTimer, getTimerStatus functions
    - Wire timer functions to FocusTimerContext
    - _Requirements: 8.1-8.3, 9.1-9.5_
  - [x] 2.3 Add query functions


    - Implement listTasks, getTaskDetails, getNextSubtask functions
    - Implement "what's next" logic (active timer task first, then highest progress)
    - _Requirements: 10.1-10.3_
  - [x] 2.4 Write property tests for FunctionCaller


    - **Property 2: Completion operations mark the correct item**
    - **Property 3: Edit operations modify the correct items**
    - **Property 5: Timer operations correctly transition state**
    - **Property 6: Query operations return accurate information**
    - **Validates: Requirements 5.1, 5.2, 6.1-6.4, 9.1-9.5, 10.1-10.3**

- [x] 3. Implement task context and pronoun resolution






  - [x] 3.0 Add database migration for updated_at column

    - Create migration to add updated_at column to big_tasks table
    - Add trigger to auto-update updated_at on row changes
    - _Requirements: 13.2_


  - [x] 3.1 Create task context loader
    - Create `src/services/assistantContext.ts`
    - Implement loadTaskContext function (20 most recently updated active tasks)

    - Query using updated_at column ordering
    - _Requirements: 13.1, 13.2_
  - [x] 3.2 Implement pronoun resolution
    - Track lastReferencedTaskId and lastReferencedSubtaskId in conversation state

    - Implement resolveTaskReference function for "it", "that task", "the last one"
    - Return clarification request when reference cannot be resolved
    - _Requirements: 13.3, 13.4_


  - [x] 3.3 Implement context update after operations
    - Update task context after create, complete, edit, delete operations
    - Update lastReferencedTaskId after each task-specific operation
    - _Requirements: 13.5_
  - [x] 3.4 Write property tests for context management
    - **Property 9: Task context limited to 20 active tasks**
    - **Property 10: Pronoun resolution uses last referenced task**
    - **Property 11: Context updates after task operations**
    - **Validates: Requirements 13.1-13.5**

- [x] 4. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement ChatService with Groq






  - [x] 5.1 Create shared system prompt

    - Create `src/services/assistantPrompt.ts`
    - Define system prompt constant (shared between Groq and Vapi)
    - Include assistant personality, capabilities, and confirmation behavior
    - _Requirements: 11.1, 12.1_
  - [x] 5.2 Create ChatService


    - Create `src/services/chatService.ts`
    - Set up Groq client with API key from environment (VITE_GROQ_API_KEY)
    - Import system prompt from assistantPrompt.ts
    - Define function schemas for all AssistantFunctions
    - _Requirements: 2.1, 11.1, 12.1_
  - [x] 5.3 Implement message processing

    - Implement sendMessage with function calling support
    - Parse function calls from Groq response
    - Execute function calls via FunctionCaller
    - Return assistant response text
    - _Requirements: 2.1, 2.2_

  - [x] 5.4 Add confirmation flow for task creation
    - Track pending task creation in conversation state
    - Require explicit confirmation before calling createTask with confirmed=true
    - _Requirements: 4.1, 4.6, 4.7_
  - [x] 5.5 Add confirmation flow for destructive actions

    - Track pending destructive actions (delete, clear)
    - Require explicit confirmation before executing
    - _Requirements: 7.3_
  - [x] 5.6 Add disambiguation handling


    - Detect when multiple tasks/subtasks match a name
    - Return clarification request instead of executing
    - _Requirements: 5.3_
  - [x] 5.7 Write property tests for ChatService


    - **Property 1: Task creation requires explicit confirmation**
    - **Property 4: Destructive operations require confirmation**
    - **Property 7: Disambiguation requested for ambiguous matches**
    - **Validates: Requirements 4.1, 4.7, 5.3, 7.3**

- [x] 6. Implement chat history persistence






  - [x] 6.1 Create chat storage utilities

    - Create `src/utils/chatStorage.ts`
    - Implement saveMessage, loadMessages, clearMessages functions
    - Use localStorage with key `assistant_chat_${userId}`
    - Limit stored messages to 50 (remove oldest when exceeded)
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 6.2 Write property test for chat storage

    - **Property 12: Chat history limited to 50 messages**
    - **Validates: Requirements 14.1, 14.2**

- [x] 7. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build AssistantPage UI






  - [x] 8.1 Create AssistantPage component

    - Create `src/pages/AssistantPage.tsx`
    - Add page layout with chat area and input
    - Load chat history on mount
    - Load task context on mount
    - _Requirements: 1.1, 1.2, 14.2_

  - [x] 8.2 Create ChatView component

    - Create `src/components/ChatView.tsx`
    - Display message history (user right, assistant left)
    - Auto-scroll to latest message
    - Show loading indicator while waiting for response

    - _Requirements: 2.3, 2.4_
  - [x] 8.3 Create ChatInput component

    - Create `src/components/ChatInput.tsx`
    - Text input with send button
    - Handle Enter key to send
    - Disable while loading
    - _Requirements: 2.1_
  - [x] 8.4 Wire up chat flow


    - Connect ChatInput to ChatService
    - Update message history after each exchange
    - Persist messages to localStorage
    - Update task context after function calls
    - _Requirements: 2.1-2.4, 13.5, 14.1_

- [x] 9. Implement VapiService for Klaw (Voice)










  - [x] 9.1 Create VapiService

    - Create `src/services/vapiService.ts`
    - Initialize Vapi client with API key (VITE_VAPI_API_KEY)
    - Implement startSession, endSession methods
    - Set up event handlers for transcript, response, function call, error
    - _Requirements: 3.1, 3.2_

  - [x] 9.2 Configure Klaw's voice assistant

    - Import KLAW_SYSTEM_PROMPT from assistantPrompt.ts (energetic personality)
    - Define function schemas matching ChatService (same capabilities)
    - Configure voice settings (voice ID, speed, etc.)
    - NOTE: Klaw uses different personality prompt than Clea but same function definitions
    - _Requirements: 11.1, 12.1_

  - [x] 9.3 Wire function calls to FunctionCaller

    - Handle onFunctionCall events from Vapi
    - Execute via FunctionCaller
    - Return results to Vapi
    - _Requirements: 2.2_

- [x] 10. Build Klaw's voice call UI





  - [x] 10.1 Create VoiceCallButton component
    - Create `src/components/VoiceCallButton.tsx`
    - Show call/end call button based on state
    - Display visual indicator for call state (idle, connecting, active, error)
    - _Requirements: 1.3, 3.1, 3.2, 3.3_
  - [x] 10.2 Add voice call state to AssistantPage


    - Track voice call state (idle, connecting, active, error)
    - Handle Klaw card tap to start/end session (from AssistantPicker)
    - Display error message with retry on connection failure
    - _Requirements: 3.1, 3.2, 3.4_


  - [x] 10.3 Create VoiceCallView component

    - Create `src/components/VoiceCallView.tsx`
    - Show Klaw's image and name during active call
    - Show transcript of conversation in real-time
    - Show end call button
    - _Requirements: 3.2, 3.3_

- [x] 11. Implement voice call persistence (Klaw)




  - [x] 11.1 Create VoiceCallProvider context

    - Create `src/contexts/VoiceCallContext.tsx`
    - Manage Klaw's voice call state globally
    - Wrap app in provider (App.tsx)
    - _Requirements: 15.1_


  - [x] 11.2 Create FloatingCallIndicator component


    - Create `src/components/FloatingCallIndicator.tsx`
    - Show Klaw's image when voice call active and not on AssistantPage
    - Position above Now-Active Bar (higher z-index)
    - Navigate to AssistantPage on tap

    - _Requirements: 15.2, 15.3, 15.5_

  - [x] 11.3 Add FloatingCallIndicator to App
    - Render FloatingCallIndicator in App.tsx
    - Conditionally show based on voice call state and current route
    - _Requirements: 15.2_

- [ ] 12. Implement tier gating for Klaw (voice)
  - [ ] 12.1 Create UpgradePrompt component
    - Create `src/components/UpgradePrompt.tsx`
    - Display Klaw's voice benefits and upgrade CTA
    - Include "Maybe later" dismiss option
    - Friendly, inviting tone (not a wall)
    - _Requirements: 16.1, 16.2_
  - [ ] 12.2 Add tier check to Klaw selection
    - Check user tier before starting Vapi session
    - Show UpgradePrompt for free-tier users when tapping Klaw
    - Allow paid users to proceed
    - _Requirements: 16.1, 16.3_
  - [ ] 12.3 Handle subscription expiry
    - Detect expired subscription on voice call attempt
    - Show renewal prompt
    - _Requirements: 16.4_
  - [ ] 12.4 Implement rate limiting
    - Add chat rate limit tracking in localStorage (100/day free, 500/day paid) for Clea
    - Add voice_minutes_used and voice_minutes_reset_month columns to profiles table for Klaw
    - Track voice minutes in Supabase (60 min/month paid)
    - NOTE: Voice limits MUST be in Supabase (not localStorage) to prevent gaming - real cost per minute
    - Show limit reached messages when exceeded
    - _Requirements: Cost guardrails_

- [ ] 13. Final integration and polish
  - [ ] 13.1 Add "goodbye" voice command to end Klaw's call
    - Detect "goodbye" in Vapi transcript
    - Automatically end session
    - _Requirements: 3.2_
  - [ ] 13.2 Add clear chat functionality for Clea
    - Add "Clear chat" button to AssistantPage (already implemented)
    - Show confirmation before clearing
    - Clear localStorage on confirm
    - _Requirements: 14.3_
  - [ ] 13.3 Add response time optimization
    - Ensure responses within 3 seconds of command recognition
    - Add timeout handling for slow responses
    - _Requirements: 12.2_

- [ ] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
