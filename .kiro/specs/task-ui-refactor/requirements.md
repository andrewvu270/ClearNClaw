# Requirements Document

## Introduction

Task UI Refactor for Clear & Claw — a comprehensive redesign of the task management interface to improve usability, reduce friction, and better support upcoming features (push notifications and recurring tasks). The refactor introduces compact task cards, a detail modal for task management, and a dual-tab navigation system (List/Focus) with intelligent task grouping (Planned/Active/Done).

## Glossary

- **Task Breaker**: The core Clear & Claw system that manages tasks, sub-tasks, coins, and rewards
- **Big Task**: A top-level task entered by the user
- **Sub-Task**: A smaller actionable step belonging to a Big Task
- **Compact Task Card**: A condensed task display showing only essential information (emoji, name, progress, coins, checkbox)
- **Detail Modal**: A modal overlay that displays full task information and allows editing
- **Focus View**: The existing full-screen view for working on a task with timer support
- **List Tab**: The main task list view showing all tasks grouped by status
- **Focus Tab**: A dedicated view showing only the task with an active timer
- **Planned Task**: A Big Task with zero Sub-Tasks completed
- **Active Task**: A Big Task with at least one Sub-Task completed but not all
- **Done Task**: A Big Task with all Sub-Tasks completed
- **Quick Complete**: Completing a Big Task directly from the task card checkbox, bypassing individual Sub-Task completion
- **Energy Tag**: An internal label (High/Medium/Low) set by the AI agent that determines coin rewards (3/2/1 coins). Not visible or editable by users.

## Requirements

### Requirement 1

**User Story:** As a user with ADHD, I want to see all my tasks in a compact list format, so that I can quickly scan and choose what to work on without visual overwhelm.

#### Acceptance Criteria

1. WHEN a user views the List tab, THE Task Breaker SHALL display each Big Task as a compact card showing emoji, task name, progress indicator (X/Y done), coin reward preview, and a completion checkbox
2. WHEN a user views a compact task card, THE Task Breaker SHALL display the card with the same compact size and styling as Sub-Task items in the Focus View (single-line layout, approximately 60-80px height)
3. WHEN a user views the List tab, THE Task Breaker SHALL group tasks into three sections: Planned (0 Sub-Tasks done), Active (some Sub-Tasks done), and Done (all Sub-Tasks done)
4. WHEN a user views the Planned section, THE Task Breaker SHALL display only Big Tasks where zero Sub-Tasks are completed
5. WHEN a user views the Active section, THE Task Breaker SHALL display only Big Tasks where at least one Sub-Task is completed but not all
6. WHEN a user views the Done section, THE Task Breaker SHALL display only Big Tasks where all Sub-Tasks are completed
7. WHEN a user taps anywhere on a compact task card except the checkbox, THE Task Breaker SHALL open the Detail Modal for that task

### Requirement 2

**User Story:** As a user with ADHD, I want to quickly complete simple tasks without opening the full view, so that I can maintain momentum and reduce friction.

#### Acceptance Criteria

1. WHEN a user taps the checkbox on a compact task card, THE Task Breaker SHALL display a confirmation modal asking "Complete this task and earn X coins?"
2. WHEN a user confirms quick completion, THE Task Breaker SHALL mark all Sub-Tasks as completed, mark the Big Task as completed, award coins based on the Energy Tag, and move the task to the Done section
3. WHEN a user cancels quick completion, THE Task Breaker SHALL close the confirmation modal and leave the task unchanged
4. WHEN a user quick-completes a task, THE Task Breaker SHALL use the same coin award logic as completing all Sub-Tasks individually (1/2/3 coins based on Energy Tag)

### Requirement 3

**User Story:** As a user with ADHD, I want to view and edit task details in a modal, so that I can manage tasks without losing context of my task list.

#### Acceptance Criteria

1. WHEN a user taps a compact task card, THE Task Breaker SHALL open a Detail Modal overlaying the current view
2. WHEN the Detail Modal opens, THE Task Breaker SHALL display the task name (editable), task emoji (editable), coin reward (read-only), and the full list of Sub-Tasks as read-only text without checkboxes
3. WHEN a user edits the task name in the Detail Modal, THE Task Breaker SHALL save the change immediately when the user taps outside the input or presses Enter
4. WHEN a user edits the task emoji in the Detail Modal, THE Task Breaker SHALL save the change immediately when the user taps outside the input or presses Enter
5. WHEN a user views Sub-Tasks in the Detail Modal, THE Task Breaker SHALL display each Sub-Task with its emoji and name, showing completed Sub-Tasks with strikethrough styling
6. WHEN a user taps the Delete button in the Detail Modal, THE Task Breaker SHALL delete the Big Task and all its Sub-Tasks, close the modal, and remove the task from the list
7. WHEN a user taps the Start Focus button in the Detail Modal, THE Task Breaker SHALL close the modal and open the Focus View for that task
8. WHEN a user taps outside the Detail Modal or taps the close button, THE Task Breaker SHALL close the modal and return to the task list

### Requirement 4

**User Story:** As a user with ADHD, I want a dedicated Focus tab that shows my currently active timer task, so that I can quickly return to what I'm working on.

#### Acceptance Criteria

1. WHEN a user taps the Focus tab, THE Task Breaker SHALL display only the Big Task that currently has an active timer running
2. WHEN no timer is active and the user views the Focus tab, THE Task Breaker SHALL display an empty state message: "Start a timer on any task to focus"
3. WHEN a timer is active and the user views the Focus tab, THE Task Breaker SHALL display the task as a compact card with a "View Focus" button
4. WHEN a user taps the "View Focus" button on the Focus tab, THE Task Breaker SHALL open the Focus View for that task
5. WHEN a user stops a timer, THE Task Breaker SHALL update the Focus tab to show the empty state
6. WHEN a user starts a timer on a task, THE Task Breaker SHALL update the Focus tab to show that task

### Requirement 5

**User Story:** As a user with ADHD, I want to switch between List and Focus views using tabs, so that I can easily navigate between browsing all tasks and focusing on one.

#### Acceptance Criteria

1. WHEN a user views the Tasks page, THE Task Breaker SHALL display two tabs: "List" and "Focus"
2. WHEN a user taps the List tab, THE Task Breaker SHALL display the grouped task list (Planned/Active/Done)
3. WHEN a user taps the Focus tab, THE Task Breaker SHALL display the currently focused task or empty state
4. WHEN a user switches tabs, THE Task Breaker SHALL preserve the scroll position and state of the previous tab
5. WHEN a user opens the app, THE Task Breaker SHALL default to the List tab

### Requirement 6

**User Story:** As a user with ADHD, I want the energy tag system to work invisibly in the background, so that I receive appropriate coin rewards without decision fatigue.

#### Acceptance Criteria

1. WHEN the DigitalOcean Agent returns Sub-Tasks for a new Big Task, THE Task Breaker SHALL store the Energy Tag (high/medium/low) in the database but not display it in any user interface
2. WHEN a user views a task card or Detail Modal, THE Task Breaker SHALL display only the coin reward amount (🪙+1, 🪙+2, or 🪙+3) without showing the Energy Tag label or emoji
3. WHEN a user completes a Big Task, THE Task Breaker SHALL award coins based on the stored Energy Tag (1 coin for low, 2 coins for medium, 3 coins for high)
4. WHEN a user views any task interface, THE Task Breaker SHALL not provide any UI element to view or edit the Energy Tag

### Requirement 7

**User Story:** As a user with ADHD, I want the existing Focus View to remain unchanged, so that my timer-based workflow continues to work as expected.

#### Acceptance Criteria

1. WHEN a user opens the Focus View from the Detail Modal or Focus tab, THE Task Breaker SHALL display the full-screen Focus View with the task emoji, name, progress ring, Sub-Task list, and timer controls
2. WHEN a user is in the Focus View, THE Task Breaker SHALL allow editing the task name, emoji, and Sub-Tasks as before
3. WHEN a user starts a timer in the Focus View, THE Task Breaker SHALL display the countdown and progress ring as before
4. WHEN a user completes all Sub-Tasks in the Focus View, THE Task Breaker SHALL display the completion confirmation modal as before
5. WHEN a user taps the back button in the Focus View, THE Task Breaker SHALL close the Focus View and return to the previous view (List tab or Focus tab)
