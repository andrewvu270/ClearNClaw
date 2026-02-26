# Requirements Document

## Introduction

UX Flow Refinement for Clear & Claw — a set of improvements to streamline the task management flow by: (1) removing the List/Focus tab system in favor of a single task list page, (2) simplifying task cards to show emoji, name, and a settings icon (no checkbox), (3) repurposing the Task Detail Sheet as a Task Settings panel (reminder, repeat, delete), (4) making tap-on-card open Focus View directly, (5) rendering done tasks in a read-only Focus View with timer disabled, (6) adding a persistent "now-active" bar when a timer is active, and (7) enforcing a single active timer with auto-swap behavior.

## Glossary

- **Task Breaker**: The core Clear & Claw system that manages tasks, sub-tasks, coins, and rewards
- **Big Task**: A top-level task entered by the user
- **Sub-Task**: A smaller actionable step belonging to a Big Task
- **Task Settings Sheet**: A full-screen slide-up panel for configuring task settings (reminder, repeat, delete) — distinct from Focus View
- **Focus View**: The existing full-screen view for working on a task with timer, subtask checkboxes, and editable name/emoji
- **Now-Active Bar**: A persistent compact bar displayed above the bottom navigation when a timer is active, showing the focused task and remaining time
- **Auto-Swap**: The behavior where starting a new timer automatically stops any existing active timer and switches focus to the new task
- **Compact Task Card**: A simplified task display showing emoji, task name, and a settings (info) icon — no checkbox

## Requirements

### Requirement 1

**User Story:** As a user with ADHD, I want a single task list without tabs, so that I have fewer navigation decisions and can see all my tasks immediately.

#### Acceptance Criteria

1. WHEN a user opens the Tasks page, THE Task Breaker SHALL display the grouped task list (Planned/Active/Done) directly without any tab navigation
2. WHEN a user views the Tasks page, THE Task Breaker SHALL not render any List or Focus tab buttons

### Requirement 2

**User Story:** As a user with ADHD, I want simplified task cards without checkboxes, so that the task list is clean and I complete tasks intentionally through Focus View.

#### Acceptance Criteria

1. WHEN the task list renders a Compact Task Card, THE Task Breaker SHALL display only the task emoji, task name, and a settings (info) icon
2. WHEN the task list renders a Compact Task Card, THE Task Breaker SHALL not display a checkbox on the card
3. WHEN a user taps the task card area (emoji or name), THE Task Breaker SHALL open the Focus View for that task
4. WHEN a user taps the settings (info) icon on a task card, THE Task Breaker SHALL open the Task Settings Sheet for that task

### Requirement 3

**User Story:** As a mobile user with ADHD, I want a Task Settings Sheet for configuring reminders and repeat options, so that I can set up task scheduling without cluttering the Focus View.

#### Acceptance Criteria

1. WHEN the Task Settings Sheet opens, THE Task Breaker SHALL animate the transition using a slide-up motion with a duration between 250ms and 350ms
2. WHEN a user dismisses the Task Settings Sheet, THE Task Breaker SHALL animate the view sliding down and return to the task list
3. WHEN the Task Settings Sheet is open, THE Task Breaker SHALL display a toggle for reminder with a date/time picker, a repeat option (daily, weekly, custom), and a delete task button
4. WHEN a user taps the close button on the Task Settings Sheet, THE Task Breaker SHALL close the sheet and return to the task list
5. WHEN a user enables the reminder toggle, THE Task Breaker SHALL display a date/time picker for selecting the reminder time
6. WHEN a user selects a repeat option, THE Task Breaker SHALL store the repeat schedule for the task

### Requirement 4

**User Story:** As a user with ADHD, I want tapping a task to go directly to Focus View, so that I can start working with one tap.

#### Acceptance Criteria

1. WHEN a user taps a non-completed task card, THE Task Breaker SHALL open the Focus View with editable name, editable emoji, timer controls, and subtask checkboxes
2. WHEN a user taps a completed (done) task card, THE Task Breaker SHALL open the Focus View with all fields displayed as read-only and the timer controls disabled
3. WHEN a user is in the Focus View for a non-completed task, THE Task Breaker SHALL allow editing of the task name and emoji
4. WHEN a user is in the Focus View for a completed task, THE Task Breaker SHALL not allow editing of the task name, emoji, or subtask checkboxes

### Requirement 5

**User Story:** As a user with ADHD, I want a persistent now-active bar when a timer is running, so that I can always see what I'm working on and quickly return to it.

#### Acceptance Criteria

1. WHEN a timer is active (running or paused), THE Task Breaker SHALL display a Now-Active Bar above the bottom navigation bar on the Tasks page
2. WHEN the Now-Active Bar is displayed, THE Task Breaker SHALL show the focused task emoji, task name, and remaining time
3. WHEN a user taps the Now-Active Bar, THE Task Breaker SHALL open the Focus View for the active timer task
4. WHEN no timer is active, THE Task Breaker SHALL not render the Now-Active Bar
5. WHEN a timer expires or is stopped, THE Task Breaker SHALL remove the Now-Active Bar from the display

### Requirement 6

**User Story:** As a user with ADHD, I want only one timer active at a time with automatic switching, so that I stay focused on one task without managing multiple timers.

#### Acceptance Criteria

1. WHEN a user starts a timer on a new task while another timer is active, THE Task Breaker SHALL stop the existing timer and start the new timer on the selected task
2. WHEN an auto-swap occurs, THE Task Breaker SHALL update the Now-Active Bar to reflect the newly focused task
3. WHEN an auto-swap occurs, THE Task Breaker SHALL display a brief toast notification stating "Switched focus to [task name]"

### Requirement 7

**User Story:** As a user with ADHD, I want the existing Focus View functionality preserved, so that my timer-based workflow continues to work as expected.

#### Acceptance Criteria

1. WHEN a user opens the Focus View for a non-completed task, THE Task Breaker SHALL display the task emoji (editable), task name (editable), progress ring, sub-task list with checkboxes, and timer controls
2. WHEN a user starts a timer in the Focus View, THE Task Breaker SHALL display the countdown and progress ring
3. WHEN a user completes all sub-tasks in the Focus View, THE Task Breaker SHALL display the completion confirmation
4. WHEN a user taps the back button in the Focus View, THE Task Breaker SHALL close the Focus View and return to the task list
