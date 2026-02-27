# Requirements Document

## Introduction

This feature introduces a dual-mode AI assistant accessible via a dedicated "Assistant" navigation tab. Users can interact through text chat (free tier) or voice calls via Vapi (paid tier). The assistant can manage tasks, control focus timers, edit subtasks, set reminders, and more. This is particularly valuable for ADHD users who benefit from conversational interaction while multitasking or when manual input creates friction.

## Glossary

- **Assistant**: The AI-powered assistant that interprets user commands and executes task actions
- **Chat Mode**: Text-based interaction with the assistant using an LLM
- **Voice Mode**: Real-time voice conversation with the assistant using Vapi
- **Vapi**: A voice AI platform that provides real-time conversational AI capabilities via WebRTC
- **Task System**: The existing task management functionality including BigTasks, SubTasks, and focus timers
- **Focus Timer**: A countdown timer used for focused work sessions on tasks
- **Command Intent**: The parsed meaning/action from a user's spoken input
- **Function Calling**: The mechanism by which the assistant executes actions via backend functions
- **Session**: An active conversation (chat or voice) between the user and the assistant

## Requirements

### Requirement 1

**User Story:** As a user, I want to access the assistant from a dedicated navigation tab, so that I can easily find and interact with it.

#### Acceptance Criteria

1. WHEN a user taps the Assistant nav item THEN the System SHALL display the assistant chat interface
2. WHEN the assistant page loads THEN the System SHALL show a chat window with message history
3. WHEN the assistant page loads THEN the System SHALL display a call button for voice mode access

### Requirement 2

**User Story:** As a user, I want to chat with the assistant via text, so that I can manage tasks without voice.

#### Acceptance Criteria

1. WHEN a user types a message and sends it THEN the Assistant SHALL process the command and respond in text
2. WHEN the assistant processes a command THEN the Assistant SHALL execute the corresponding task action
3. WHEN the assistant responds THEN the System SHALL display the response in the chat window
4. WHILE waiting for a response THEN the System SHALL display a loading indicator

### Requirement 3

**User Story:** As a user, I want to start and stop voice conversations with the assistant, so that I can control when it is listening.

#### Acceptance Criteria

1. WHEN a user taps the call button THEN the Assistant SHALL initiate a Vapi session and begin listening
2. WHEN a user taps the end call button or says "goodbye" THEN the Assistant SHALL end the Vapi session
3. WHILE a voice session is active THEN the System SHALL display a visual indicator showing the call state
4. IF the Vapi connection fails THEN the System SHALL display an error message and allow retry

### Requirement 4

**User Story:** As a user, I want to add new tasks by chatting or speaking, so that I can capture tasks conversationally.

#### Acceptance Criteria

1. WHEN a user explicitly commands "add task" or "create task" followed by a description THEN the Assistant SHALL ask for confirmation before creating the task
2. WHEN the user confirms task creation THEN the Assistant SHALL create a new BigTask with AI-generated subtasks
3. WHEN a task is successfully created THEN the Assistant SHALL confirm the action with the task name and list all generated subtasks
4. IF the task description is unclear or empty THEN the Assistant SHALL ask the user to clarify
5. WHEN a user explicitly requests to split into separate tasks THEN the Assistant SHALL create multiple BigTasks each with their own subtasks after confirmation
6. WHEN a user mentions a task conversationally without explicit command THEN the Assistant SHALL offer to create a task and require explicit confirmation before proceeding
7. THE Assistant SHALL NOT call the AI breakdown service without explicit user confirmation

### Requirement 5

**User Story:** As a user, I want to check off tasks and subtasks conversationally, so that I can mark progress hands-free.

#### Acceptance Criteria

1. WHEN a user says or types "complete" followed by a task or subtask name THEN the Assistant SHALL mark the matching item as completed
2. WHEN a user says or types "check off" followed by a subtask name THEN the Assistant SHALL toggle the subtask completion status
3. WHEN multiple items match the spoken name THEN the Assistant SHALL ask the user to clarify which item
4. WHEN a completion action succeeds THEN the Assistant SHALL confirm the completed item name

### Requirement 6

**User Story:** As a user, I want to edit task and subtask details conversationally, so that I can update my tasks without typing in forms.

#### Acceptance Criteria

1. WHEN a user says or types "rename task" followed by the old name and new name THEN the Assistant SHALL update the BigTask name
2. WHEN a user says or types "rename subtask" followed by the old name and new name THEN the Assistant SHALL update the SubTask name
3. WHEN a user says or types "add subtask" followed by a task name and subtask description THEN the Assistant SHALL add a new subtask
4. WHEN a user says or types "remove subtask" followed by a subtask name THEN the Assistant SHALL delete the specified subtask
5. WHEN an edit action succeeds THEN the Assistant SHALL confirm the change

### Requirement 7

**User Story:** As a user, I want to delete tasks and clear completed tasks conversationally, so that I can manage my task list hands-free.

#### Acceptance Criteria

1. WHEN a user says or types "delete task" followed by a task name THEN the Assistant SHALL delete the specified BigTask after confirmation
2. WHEN a user says or types "clear done tasks" THEN the Assistant SHALL delete all completed BigTasks after confirmation
3. WHEN a destructive action is requested THEN the Assistant SHALL ask for confirmation before executing
4. WHEN deletion succeeds THEN the Assistant SHALL confirm the number of tasks removed

### Requirement 8

**User Story:** As a user, I want to set reminders and recurring schedules conversationally, so that I can configure task timing hands-free.

#### Acceptance Criteria

1. WHEN a user says or types "set reminder" followed by a task name and time THEN the Assistant SHALL set a reminder for the task
2. WHEN a user says or types "make recurring" followed by a task name and frequency THEN the Assistant SHALL configure task recurrence
3. WHEN a user says or types "remove reminder" followed by a task name THEN the Assistant SHALL clear the reminder
4. WHEN scheduling succeeds THEN the Assistant SHALL confirm the scheduled time or recurrence pattern

### Requirement 9

**User Story:** As a user, I want to control the focus timer conversationally, so that I can manage focus sessions hands-free.

#### Acceptance Criteria

1. WHEN a user says or types "start timer" with an optional duration THEN the Assistant SHALL start a focus timer
2. WHEN a user says or types "pause timer" THEN the Assistant SHALL pause the running focus timer
3. WHEN a user says or types "resume timer" THEN the Assistant SHALL resume a paused focus timer
4. WHEN a user says or types "stop timer" THEN the Assistant SHALL stop and reset the focus timer
5. WHEN a user asks "how much time is left" THEN the Assistant SHALL report the remaining timer duration

### Requirement 10

**User Story:** As a user, I want to ask about my tasks, so that I can get a quick overview conversationally.

#### Acceptance Criteria

1. WHEN a user asks "what are my tasks" THEN the Assistant SHALL provide a summary of active tasks
2. WHEN a user asks "what's next" THEN the Assistant SHALL suggest the next incomplete subtask
3. WHEN a user asks about a specific task by name THEN the Assistant SHALL provide details including subtask progress

### Requirement 11

**User Story:** As a user, I want the assistant to understand natural language variations, so that I don't have to memorize exact commands.

#### Acceptance Criteria

1. WHEN a user speaks or types a command using synonyms or variations THEN the Assistant SHALL interpret the intent correctly
2. WHEN the Assistant cannot understand a command THEN the Assistant SHALL ask for clarification politely
3. WHEN processing commands THEN the Assistant SHALL handle common speech recognition errors gracefully

### Requirement 12

**User Story:** As a user, I want assistant responses to be concise and friendly, so that interactions feel natural and efficient.

#### Acceptance Criteria

1. WHEN the Assistant responds THEN the Assistant SHALL use brief, conversational language
2. WHEN confirming actions THEN the Assistant SHALL provide feedback within 3 seconds of command recognition
3. WHEN errors occur THEN the Assistant SHALL explain the issue simply and suggest alternatives



### Requirement 13

**User Story:** As a user, I want the assistant to maintain context across my conversation, so that I can speak naturally without repeating myself.

#### Acceptance Criteria

1. WHEN a conversation session starts THEN the System SHALL load the user's active tasks (non-completed BigTasks with SubTasks) into the assistant context
2. WHEN a user has more than 20 active tasks THEN the System SHALL load only the 20 most recently updated tasks into context
3. WHEN a user references "it", "that task", or "the last one" THEN the Assistant SHALL resolve the reference to the most recently discussed task in the conversation
4. WHEN the assistant cannot resolve a pronoun reference THEN the Assistant SHALL ask the user to specify which task
5. WHEN a task is created, modified, or completed during a session THEN the System SHALL update the assistant context to reflect the change

### Requirement 14

**User Story:** As a user, I want my chat history preserved, so that I can continue conversations across sessions.

#### Acceptance Criteria

1. WHEN a user sends or receives a message THEN the System SHALL persist the message to local storage
2. WHEN the assistant page loads THEN the System SHALL restore the last 50 messages from local storage
3. WHEN a user taps "Clear chat" THEN the System SHALL delete all stored messages after confirmation
4. THE System SHALL NOT sync chat history across devices

### Requirement 15

**User Story:** As a user in a voice call, I want the call to continue if I navigate away, so that I can multitask while talking.

#### Acceptance Criteria

1. WHEN a user navigates to another page during a voice call THEN the System SHALL maintain the active Vapi session
2. WHILE a voice call is active on any page other than AssistantPage THEN the System SHALL display a floating call indicator
3. WHEN a user taps the floating call indicator THEN the System SHALL navigate back to the Assistant page
4. WHEN a user explicitly ends the call THEN the System SHALL terminate the session regardless of current page
5. WHEN both a voice call indicator and Now-Active Bar are visible THEN the floating call indicator SHALL appear above the Now-Active Bar

### Requirement 16

**User Story:** As a user, I want clear guidance when voice features require payment, so that I understand the value proposition.

#### Acceptance Criteria

1. WHEN a free-tier user taps the call button THEN the System SHALL display an upgrade prompt explaining voice benefits
2. WHEN displaying the upgrade prompt THEN the System SHALL show a "Maybe later" option to dismiss
3. THE System SHALL NOT restrict chat functionality based on tier
4. WHEN a paid user's subscription expires THEN the System SHALL gracefully disable voice and show renewal prompt

