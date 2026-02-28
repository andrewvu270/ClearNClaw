# Requirements Document

## Introduction

This feature fixes Klaw (the voice assistant) to properly execute task management functions without speaking the action tags or technical syntax out loud. Currently, Klaw speaks phrases like "ACTION createTask confirmed true done" instead of silently executing the function and responding naturally. The solution involves using Vapi's server-side function calling via a Supabase Edge Function webhook.

## Glossary

- **Klaw**: The voice assistant character (energetic, upbeat personality) powered by Vapi
- **Vapi**: Voice AI platform that handles speech-to-text, LLM processing, and text-to-speech
- **Function Calling**: Native LLM capability to invoke structured functions instead of generating text
- **Server URL Webhook**: Vapi feature that calls a backend endpoint when the LLM triggers a function
- **ACTION Tags**: Current (broken) approach using text patterns like `[ACTION:functionName:{}]` in responses
- **FunctionCaller**: Existing service (`assistantFunctions.ts`) that executes task operations
- **vapi-webhook**: New Supabase Edge Function that handles Vapi's function call requests

## Requirements

### Requirement 1

**User Story:** As a user talking to Klaw, I want my task commands to be executed silently, so that I hear natural responses instead of technical syntax.

#### Acceptance Criteria

1. WHEN Klaw executes a function THEN the system SHALL NOT vocalize any function names, parameter names, JSON syntax, or technical terms
2. WHEN Klaw creates a task THEN the system SHALL execute the createTask function and respond with natural confirmation like "Done!" or "Got it!"
3. WHEN Klaw completes a task or subtask THEN the system SHALL execute the completion function and respond with celebratory phrases
4. WHEN Klaw starts a timer THEN the system SHALL execute startTimer and confirm naturally without speaking "duration" or "taskName"

### Requirement 2

**User Story:** As a user, I want Klaw to use Vapi's server-side function calling via a webhook, so that functions execute reliably on the backend.

#### Acceptance Criteria

1. WHEN configuring the Vapi assistant THEN the system SHALL include a serverUrl pointing to the vapi-webhook edge function
2. WHEN configuring the Vapi assistant THEN the system SHALL include tool definitions for all task management functions
3. WHEN the LLM decides to call a function THEN Vapi SHALL send a POST request to the serverUrl with the function details
4. WHEN the webhook receives a function call THEN the system SHALL execute via existing task service methods and return results
5. WHEN function results are returned THEN Vapi SHALL continue the conversation with the result context

### Requirement 3

**User Story:** As a user, I want Klaw's system prompt to guide natural conversation without ACTION tag instructions, so that the model focuses on being helpful rather than formatting syntax.

#### Acceptance Criteria

1. WHEN defining Klaw's system prompt THEN the system SHALL NOT include ACTION tag syntax or examples
2. WHEN defining Klaw's system prompt THEN the system SHALL describe available capabilities in natural language
3. WHEN the model needs to perform an action THEN the system SHALL rely on function definitions (not prompt instructions) to trigger calls
4. WHEN the model responds after a function call THEN the system SHALL generate natural speech without technical references

### Requirement 4

**User Story:** As a user, I want all existing task operations to work through voice, so that Klaw has the same capabilities as Clea (chat).

#### Acceptance Criteria

1. WHEN I ask Klaw to create a task THEN the system SHALL call createTask with the task description
2. WHEN I ask Klaw to complete a task or subtask THEN the system SHALL call the appropriate completion function
3. WHEN I ask Klaw to start, pause, resume, or stop a timer THEN the system SHALL call the corresponding timer function
4. WHEN I ask Klaw to set a reminder THEN the system SHALL call setReminder with task name and time
5. WHEN I ask Klaw what to do next THEN the system SHALL call getNextSubtask and speak the result
6. WHEN I ask Klaw to list my tasks THEN the system SHALL call listTasks and summarize verbally

### Requirement 5

**User Story:** As a user, I want Klaw to handle errors gracefully, so that failed operations don't break the conversation.

#### Acceptance Criteria

1. WHEN a function call fails THEN the system SHALL return an error result to Vapi
2. WHEN Vapi receives an error result THEN Klaw SHALL explain the issue in natural speech
3. WHEN a task is not found THEN Klaw SHALL ask for clarification instead of failing silently
4. WHEN multiple tasks match a name THEN Klaw SHALL ask which one the user means


### Requirement 6

**User Story:** As a developer, I want the vapi-webhook edge function to be secure, so that only Vapi can call it with valid user context.

#### Acceptance Criteria

1. WHEN the webhook receives a request THEN the system SHALL verify the request comes from Vapi (via secret or signature)
2. WHEN the webhook receives a function call THEN the system SHALL extract the userId from the call metadata
3. WHEN executing task operations THEN the system SHALL use the userId to scope all database queries
4. WHEN the webhook encounters an error THEN the system SHALL return a structured error response that Vapi can relay to the user
