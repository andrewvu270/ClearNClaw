# Requirements Document

## Introduction

This feature introduces a voice-powered AI agent using Vapi that enables hands-free interaction with the task management system. Users can speak commands to manage tasks, control focus timers, and navigate the app without touching their device. This is particularly valuable for ADHD users who benefit from voice interaction while multitasking or when manual input creates friction.

## Glossary

- **Vapi**: A voice AI platform that provides real-time conversational AI capabilities via WebRTC
- **Voice Agent**: The AI-powered voice assistant that interprets spoken commands and executes task actions
- **Task System**: The existing task management functionality including BigTasks, SubTasks, and focus timers
- **Focus Timer**: A countdown timer used for focused work sessions on tasks
- **Wake Word**: An optional trigger phrase to activate the voice agent
- **Command Intent**: The parsed meaning/action from a user's spoken input
- **Session**: An active voice conversation between the user and the agent

## Requirements

### Requirement 1

**User Story:** As a user, I want to start and stop voice conversations with the agent, so that I can control when the agent is listening.

#### Acceptance Criteria

1. WHEN a user taps the voice agent button THEN the Voice Agent SHALL initiate a Vapi session and begin listening for commands
2. WHEN a user taps the stop button or says "goodbye" THEN the Voice Agent SHALL end the current session and stop listening
3. WHILE a voice session is active THEN the Voice Agent SHALL display a visual indicator showing the listening state
4. IF the Vapi connection fails THEN the Voice Agent SHALL display an error message and allow retry

### Requirement 2

**User Story:** As a user, I want to add new tasks by speaking, so that I can capture tasks without typing.

#### Acceptance Criteria

1. WHEN a user says "add task" followed by a description THEN the Voice Agent SHALL create a new BigTask with AI-generated subtasks
2. WHEN a task is successfully created THEN the Voice Agent SHALL confirm the action by speaking the task name back to the user
3. IF the task description is unclear or empty THEN the Voice Agent SHALL ask the user to repeat or clarify the task

### Requirement 3

**User Story:** As a user, I want to check off tasks and subtasks by voice, so that I can mark progress hands-free.

#### Acceptance Criteria

1. WHEN a user says "complete" followed by a task or subtask name THEN the Voice Agent SHALL mark the matching item as completed
2. WHEN a user says "check off" followed by a subtask name THEN the Voice Agent SHALL toggle the subtask completion status
3. WHEN multiple items match the spoken name THEN the Voice Agent SHALL ask the user to clarify which item to complete
4. WHEN a completion action succeeds THEN the Voice Agent SHALL confirm by speaking the completed item name

### Requirement 4

**User Story:** As a user, I want to control the focus timer by voice, so that I can start, pause, and stop focus sessions hands-free.

#### Acceptance Criteria

1. WHEN a user says "start timer" with an optional duration THEN the Voice Agent SHALL start a focus timer for the specified or default duration
2. WHEN a user says "pause timer" THEN the Voice Agent SHALL pause the currently running focus timer
3. WHEN a user says "resume timer" THEN the Voice Agent SHALL resume a paused focus timer
4. WHEN a user says "stop timer" THEN the Voice Agent SHALL stop and reset the focus timer
5. WHEN a user asks "how much time is left" THEN the Voice Agent SHALL speak the remaining timer duration

### Requirement 5

**User Story:** As a user, I want to ask about my tasks, so that I can get a quick overview without looking at the screen.

#### Acceptance Criteria

1. WHEN a user asks "what are my tasks" THEN the Voice Agent SHALL read a summary of active tasks
2. WHEN a user asks "what's next" THEN the Voice Agent SHALL suggest the next incomplete subtask from the focused task
3. WHEN a user asks about a specific task by name THEN the Voice Agent SHALL provide details including subtask progress

### Requirement 6

**User Story:** As a user, I want the voice agent to understand natural language variations, so that I don't have to memorize exact commands.

#### Acceptance Criteria

1. WHEN a user speaks a command using synonyms or variations THEN the Voice Agent SHALL interpret the intent correctly
2. WHEN the Voice Agent cannot understand a command THEN the Voice Agent SHALL ask for clarification politely
3. WHEN processing commands THEN the Voice Agent SHALL handle common speech recognition errors gracefully

### Requirement 7

**User Story:** As a user, I want voice feedback to be concise and friendly, so that interactions feel natural and efficient.

#### Acceptance Criteria

1. WHEN the Voice Agent responds THEN the Voice Agent SHALL use brief, conversational language
2. WHEN confirming actions THEN the Voice Agent SHALL provide feedback within 3 seconds of command recognition
3. WHEN errors occur THEN the Voice Agent SHALL explain the issue simply and suggest alternatives

